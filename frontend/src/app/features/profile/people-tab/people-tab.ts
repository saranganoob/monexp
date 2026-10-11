import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { PersonStats } from '../../../core/models';
import { MONTHS, inr, ymMonth0 } from '../../../core/utils/format';
import { firstError, notBlank, optionalMobile, optionalUpi } from '../../../core/forms/validators';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { Icon } from '../../../shared/ui/icon/icon';

export const RELATIONS = ['Friend', 'Family', 'Colleague', 'Roommate', 'Other'] as const;

/** The People list: contact details, what's owed, running EMIs; add / edit / delete. */
@Component({
  selector: 'app-people-tab',
  imports: [ReactiveFormsModule, InrPipe, Avatar, Icon],
  templateUrl: './people-tab.html',
  styleUrl: './people-tab.scss',
})
export class PeopleTab {
  protected store = inject(AppStore);
  private api = inject(Api);

  protected readonly relations = RELATIONS;
  protected readonly editingId = signal<string | null>(null);
  protected readonly message = signal<{ id: string; text: string } | null>(null);
  protected readonly error = signal('');
  protected readonly owedTotal = computed(() => this.store.people().reduce((s, p) => s + p.owed, 0));

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [notBlank, Validators.maxLength(80)]],
    relation: [''],
    phone: ['', optionalMobile],
    upi: ['', optionalUpi],
    note: ['', Validators.maxLength(200)],
  });

  protected readonly rows = computed(() => {
    const month = MONTHS[ymMonth0(this.store.ym())];
    return this.store.people().map((p) => {
      const youOwe = p.iOwe > 0 && !p.owed;
      const stats = [
        ...(p.runningEmis ? [`${p.runningEmis} EMI${p.runningEmis > 1 ? 's' : ''} running · ${inr(p.leftToRecover)} left to recover`] : []),
        `${inr(p.receivedSoFar)} received so far`,
      ].join(' · ');
      return {
        p, stats, youOwe,
        contact: [p.phone ? '+91 ' + p.phone : '', p.upi, p.note].filter(Boolean).join(' · ') || 'No phone or UPI saved',
        amount: youOwe ? p.iOwe : p.owed,
        amountLabel: `${youOwe ? 'you owe' : 'owes you'} · ${month}`,
      };
    });
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  edit(p: PersonStats) {
    this.editingId.set(p.id);
    this.message.set(null);
    this.form.setValue({ name: p.name, relation: p.relation, phone: p.phone, upi: p.upi, note: p.note });
    setTimeout(() => {
      document.getElementById('person-form')?.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('pfName')?.focus({ preventScroll: true });
    });
  }

  cancel() {
    this.editingId.set(null);
    this.form.reset();
  }

  async remove(p: PersonStats) {
    const err = await this.store.run(this.api.deletePerson(p.id), { quiet: true });
    this.message.set(err ? { id: p.id, text: err } : null);
  }

  digitsOnly() {
    const c = this.form.controls.phone;
    const clean = c.value.replace(/\D/g, '').slice(0, 10);
    if (clean !== c.value) c.setValue(clean, { emitEvent: false });
  }

  async save() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      name: { required: 'Add a name.' },
      phone: { mobile: 'Enter a 10-digit Indian mobile number, or leave it empty.' },
      upi: { upi: 'A UPI ID looks like name@bank.' },
    }));
    if (this.error()) return;
    const v = this.form.getRawValue(), id = this.editingId();
    const body = { name: v.name.trim(), relation: v.relation, phone: v.phone, upi: v.upi.trim(), note: v.note.trim() };
    const err = await this.store.run(id ? this.api.updatePerson(id, body) : this.api.addPerson(body), { quiet: true });
    if (err) return this.error.set(err);
    this.cancel();
  }
}
