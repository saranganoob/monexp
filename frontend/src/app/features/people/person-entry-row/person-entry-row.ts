import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { dayMonth, fmtInput, inr, parseNum, todayIso } from '../../../core/utils/format';
import { firstError, notBlank, rupees } from '../../../core/forms/validators';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { PersonRow } from '../../../shared/utils/person-row';
import { entryKey, toggleEntry } from '../../../shared/utils/entry-actions';
import { Busy } from '../../../shared/directives/busy';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { Icon } from '../../../shared/ui/icon/icon';

/** One "they owe me / I owe them" line: Mark received, Record part (₹6,000 of ₹10,000), Edit and Delete. */
@Component({
  selector: 'app-person-entry-row',
  imports: [ReactiveFormsModule, InrPipe, Avatar, Icon, Busy],
  templateUrl: './person-entry-row.html',
  styleUrl: './person-entry-row.scss',
})
export class PersonEntryRow {
  protected store = inject(AppStore);
  private api = inject(Api);

  readonly row = input.required<PersonRow>();
  readonly editing = input(false);
  readonly edit = output<void>();
  readonly closed = output<void>();
  /** The "Record part" box is open. */
  protected readonly partOpen = signal(false);
  protected readonly partError = signal('');
  protected readonly partForm = inject(NonNullableFormBuilder).group({ amount: ['', rupees(1)], date: [''] });
  protected readonly today = todayIso();
  protected readonly dayMonth = dayMonth;

  protected readonly error = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    amount: ['', rupees(1)],
  });

  constructor() {
    // Fill the form each time editing opens.
    effect(() => {
      if (!this.editing()) return;
      const r = this.row().r;
      this.form.setValue({ name: r.name, amount: fmtInput(r.amount) });
      this.error.set('');
      setTimeout(() => (document.getElementById('rowAmt-' + r.id) as HTMLInputElement | null)?.select());
    });
  }

  protected readonly key = computed(() => entryKey(this.row().r));
  protected readonly saving = computed(() => this.store.loading.isPending(this.key()));
  toggle() { toggleEntry(this.api, this.store, this.row().r); }
  remove() { const id = this.row().r.id; this.store.run(() => this.api.deleteEntry(id), { key: `remove:${id}` }); }

  protected openPart() {
    this.partOpen.set(true);
    this.partError.set('');
    this.partForm.setValue({ amount: '', date: this.today });
    setTimeout(() => (document.getElementById('partAmt-' + this.row().r.id) as HTMLInputElement | null)?.focus());
  }

  /** Part of the money came in / was paid back. Settles the entry once it's all there. */
  async savePart() {
    this.partForm.markAllAsTouched();
    const left = this.row().left;
    const amount = parseNum(this.partForm.controls.amount.value);
    if (!amount) return this.partError.set('Enter the amount, above ₹0.');
    if (amount > left) return this.partError.set(`Only ${inr(left)} is left.`);
    const id = this.row().r.id, date = this.partForm.controls.date.value || this.today;
    const err = await this.store.run(() => this.api.addEntryPart(id, { amount, date }), { quiet: true, key: `part:${id}` });
    if (err) return this.partError.set(err);
    this.partOpen.set(false);
  }

  removePart(partId: string) {
    const id = this.row().r.id;
    this.store.run(() => this.api.deleteEntryPart(id, partId), { key: `part-del:${partId}` });
  }

  async save() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      name: { required: 'Add who this is.' },
      amount: { required: 'Enter an amount above ₹0 — or delete the entry if nothing is due.', min: 'Enter an amount above ₹0 — or delete the entry if nothing is due.', rupees: 'Amount must be whole rupees.' },
    }));
    if (this.error()) return;
    const v = this.form.getRawValue();
    const id = this.row().r.id, body = { name: v.name.trim(), amount: parseNum(v.amount) };
    const err = await this.store.run(() => this.api.updateEntry(id, body), { quiet: true, key: `save:${id}` });
    if (err) return this.error.set(err);
    this.closed.emit();
  }
}
