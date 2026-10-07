import { Component, computed, effect, inject, signal } from '@angular/core';
import { Store } from '../../core/store';
import { Api } from '../../core/api.service';
import { Sudden } from '../../core/models';
import { MONTHS, defaultDate, inr, lastDay, parseNum, val, ymLabel } from '../../core/format';

@Component({
  selector: 'app-sudden',
  templateUrl: './sudden.html',
})
export class SuddenPage {
  protected store = inject(Store);
  private api = inject(Api);
  protected inr = inr;
  protected val = val;

  protected m = this.store.month;
  protected label = computed(() => ymLabel(this.store.ym()));
  protected name = signal('');
  protected amount = signal('');
  protected mode = signal('UPI');
  protected date = signal('');
  protected err = signal('');
  protected minDate = computed(() => `${this.store.ym()}-01`);
  protected maxDate = computed(() => `${this.store.ym()}-${String(lastDay(this.store.ym())).padStart(2, '0')}`);
  protected modeOptions = computed(() => [
    { value: 'UPI', label: 'UPI' }, { value: 'Cash', label: 'Cash' }, { value: 'Bank account', label: 'Bank account / debit card' },
    ...this.store.cards().filter((c) => !c.closedOn).map((c) => ({ value: 'card:' + c.id, label: c.name + ' credit card' })),
  ]);
  protected rows = computed(() => (this.m()?.suddenSpends ?? []).map((s) => ({
    s,
    when: s.dateUnknown ? `${MONTHS[Number(s.date.slice(5, 7)) - 1]} (date not in sheet)` : `${Number(s.date.slice(8, 10))} ${MONTHS[Number(s.date.slice(5, 7)) - 1]}`,
    mode: s.mode + (s.cardId ? ' · already in a card bill, not deducted again' : ''),
  })));

  constructor() {
    effect(() => this.date.set(defaultDate(this.store.ym())));
  }

  async add() {
    const nm = this.name().trim(), a = parseNum(this.amount());
    if (!nm || !a) return this.err.set('Add what it was and an amount above ₹0.');
    if (this.date() < this.minDate() || this.date() > this.maxDate()) return this.err.set(`Pick a date inside ${this.label()}.`);
    const error = await this.store.run(this.api.addSudden(this.store.ym(), { name: nm, amount: a, mode: this.mode(), date: this.date() }), { quiet: true });
    if (error) return this.err.set(error);
    this.name.set(''); this.amount.set(''); this.err.set('');
  }

  remove(s: Sudden) { this.store.run(this.api.deleteSudden(s.id)); }
}
