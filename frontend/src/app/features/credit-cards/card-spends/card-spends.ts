import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { CardSpendItem, CardView } from '../../../core/models';
import { defaultDate, firstDate, inr, lastDate, parseNum, ymLabel } from '../../../core/utils/format';
import { dateBetween, firstError, rupees } from '../../../core/forms/validators';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Icon } from '../../../shared/ui/icon/icon';
import { Busy } from '../../../shared/directives/busy';

/** "Add a new spend" (what, amount, date) and the list of itemised spends on a card. */
@Component({
  selector: 'app-card-spends',
  imports: [ReactiveFormsModule, InrPipe, YmPipe, Icon, Busy],
  templateUrl: './card-spends.html',
  styleUrl: './card-spends.scss',
})
export class CardSpends {
  protected store = inject(AppStore);
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);

  readonly card = input.required<CardView>();
  protected readonly minDate = computed(() => firstDate(this.store.ym()));
  protected readonly maxDate = computed(() => lastDate(this.store.ym()));
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    name: ['', Validators.maxLength(120)],
    amount: ['', rupees(1)],
    date: [defaultDate(this.store.ym()), dateBetween(() => this.minDate(), () => this.maxDate())],
  });
  private readonly amount = toSignal(this.form.controls.amount.valueChanges, { initialValue: '' });
  protected readonly preview = computed(() => {
    const add = parseNum(this.amount()), c = this.card();
    return add ? `${inr(c.spends)} + ${inr(add)} = ${inr(c.spends + add)}` : '';
  });

  constructor() {
    // Switching month moves the default date into that month.
    effect(() => this.form.controls.date.setValue(defaultDate(this.store.ym())));
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  async add() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      amount: { required: 'Enter an amount above ₹0 to add.', min: 'Enter an amount above ₹0 to add.', rupees: 'Amount must be whole rupees.' },
      date: { dateRange: `Pick a date inside ${ymLabel(this.store.ym())}.` },
    }));
    if (this.error()) return;
    const v = this.form.getRawValue();
    const ym = this.store.ym(), cardId = this.card().id;
    const body = { name: v.name.trim() || 'Spend', amount: parseNum(v.amount), date: v.date };
    const err = await this.store.run(() => this.api.addCardSpend(ym, cardId, body), { quiet: true, key: this.addKey() });
    if (err) return this.error.set(err);
    this.form.patchValue({ name: '', amount: '' });
    this.form.markAsUntouched();
  }

  protected readonly addKey = () => `add-spend:${this.card().id}`;
  remove(item: CardSpendItem) { this.store.run(() => this.api.deleteCardSpend(item.id), { key: `remove:${item.id}` }); }
}
