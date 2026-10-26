import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { defaultDate, firstDate, lastDate, parseNum, ymLabel } from '../../../core/utils/format';
import { dateBetween, firstError, notBlank, rupees } from '../../../core/forms/validators';
import { Busy } from '../../../shared/directives/busy';

/** "Log an unplanned spend" form. */
@Component({
  selector: 'app-sudden-form',
  imports: [ReactiveFormsModule, Busy],
  templateUrl: './sudden-form.html',
  styleUrl: './sudden-form.scss',
})
export class SuddenForm {
  protected store = inject(AppStore);
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);

  protected readonly minDate = computed(() => firstDate(this.store.ym()));
  protected readonly maxDate = computed(() => lastDate(this.store.ym()));
  protected readonly error = signal('');
  protected readonly modeOptions = computed(() => [
    { value: 'UPI', label: 'UPI' }, { value: 'Cash', label: 'Cash' }, { value: 'Bank account', label: 'Bank account / debit card' },
    ...this.store.cards().filter((c) => !c.closedOn).map((c) => ({ value: 'card:' + c.id, label: `${c.name} credit card` })),
  ]);

  protected readonly form = this.fb.group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    amount: ['', rupees(1)],
    mode: ['UPI'],
    date: ['', dateBetween(() => this.minDate(), () => this.maxDate())],
  });
  private readonly mode = toSignal(this.form.controls.mode.valueChanges, { initialValue: 'UPI' });
  protected readonly byCard = computed(() => this.mode().startsWith('card:'));

  constructor() {
    effect(() => this.form.controls.date.setValue(defaultDate(this.store.ym())));
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  async add() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      name: { required: 'Add what it was.' },
      amount: { required: 'Add an amount above ₹0.', min: 'Add an amount above ₹0.', rupees: 'Amount must be whole rupees.' },
      date: { dateRange: `Pick a date inside ${ymLabel(this.store.ym())}.` },
    }));
    if (this.error()) return;
    const v = this.form.getRawValue();
    const ym = this.store.ym(), body = { name: v.name.trim(), amount: parseNum(v.amount), mode: v.mode, date: v.date };
    const err = await this.store.run(() => this.api.addSudden(ym, body), { quiet: true, key: 'add-sudden' });
    if (err) return this.error.set(err);
    this.form.patchValue({ name: '', amount: '' });
    this.form.markAsUntouched();
  }
}
