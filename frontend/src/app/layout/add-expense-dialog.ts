import { AfterViewInit, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '../core/store';
import { Api } from '../core/api.service';
import { FULL_MONTHS, defaultDate, inr, lastDay, makeYm, parseNum, val, ymLabel, ymMonth0, ymYear } from '../core/format';

type DType = 'bill' | 'sudden' | 'in' | 'out';
const TYPES: [DType, string, string][] = [
  ['bill', 'Bill / expense', 'Goes to Need to pay'],
  ['sudden', 'Sudden spend', 'Unplanned, one-off'],
  ['in', 'They owe me', 'You lent or paid'],
  ['out', 'I owe them', 'You borrowed'],
];

/** The "Add expense" dialog – adds a bill, sudden spend or people entry to any month. */
@Component({
  selector: 'app-add-expense-dialog',
  templateUrl: './add-expense-dialog.html',
  host: { '(document:keydown.escape)': 'close()' },
})
export class AddExpenseDialog implements AfterViewInit {
  protected store = inject(Store);
  private api = inject(Api);
  private router = inject(Router);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly types = TYPES;
  protected readonly months = FULL_MONTHS;
  protected readonly val = val;

  protected type = signal<DType>(this.store.dialog()?.type ?? 'bill');
  protected y = signal(ymYear(this.store.ym()));
  protected m0 = signal(ymMonth0(this.store.ym()));
  protected ym = computed(() => makeYm(this.y(), this.m0()));
  protected years = computed(() => { const n = new Date().getFullYear(); return [...new Set([n - 1, n, n + 1, this.y()])].sort(); });

  protected name = signal('');
  protected amount = signal('');
  protected category = signal('fam');
  protected due = signal('');
  protected status = signal('unpaid');
  protected mode = signal('UPI');
  protected date = signal(defaultDate(this.store.ym()));
  protected person = signal('');
  protected newPerson = signal('');
  protected err = signal('');
  protected busy = signal(false);

  protected isPerson = computed(() => this.type() === 'in' || this.type() === 'out');
  protected modeOptions = computed(() => [
    { value: 'UPI', label: 'UPI' }, { value: 'Cash', label: 'Cash' }, { value: 'Bank account', label: 'Bank account / debit card' },
    ...this.store.cards().filter((c) => !c.closedOn).map((c) => ({ value: 'card:' + c.id, label: c.name + ' credit card' })),
  ]);
  protected hint = computed(() => {
    const exists = this.ym() === this.store.ym() && this.store.view()?.exists;
    return exists || this.ym() !== this.store.ym()
      ? 'It’s saved under this month — change the month or year above if needed.'
      : `${ymLabel(this.ym())} isn’t set up yet. Saving will create it, carrying over your recurring bills from the latest earlier month.`;
  });
  protected nameLabel = computed(() => (this.type() === 'bill' ? 'What is it?' : this.type() === 'sudden' ? 'What was it?' : 'What for? (optional)'));
  protected namePh = computed(() => (this.type() === 'bill' ? 'e.g. Electricity bill' : this.type() === 'sudden' ? 'e.g. Bike service' : 'e.g. Movie tickets'));
  protected saveLabel = computed(() => ({ bill: 'Add bill', sudden: 'Add spend', in: 'Add — they owe me', out: 'Add — I owe them' })[this.type()]);
  protected minDate = computed(() => `${this.ym()}-01`);
  protected maxDate = computed(() => `${this.ym()}-${String(lastDay(this.ym())).padStart(2, '0')}`);

  ngAfterViewInit() {
    setTimeout(() => this.el.nativeElement.querySelector<HTMLElement>(this.isPerson() ? '#dPerson' : '#dName')?.focus());
  }

  typeStyle(on: boolean) {
    return `font: inherit; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; min-height: 56px; padding: 10px 12px; border-radius: 12px; cursor: pointer; font-size: 14px; border: 1.5px solid ${on ? '#1D4ED8' : '#D5DAE1'}; background: ${on ? '#E8EEFC' : '#fff'}; color: ${on ? '#1E3A8A' : '#374151'}`;
  }

  pickMonth(e: Event) {
    this.m0.set(Number(val(e)));
    this.date.set(defaultDate(this.ym()));
  }
  pickYear(e: Event) {
    this.y.set(Number(val(e)));
    this.date.set(defaultDate(this.ym()));
  }
  close() { this.store.dialog.set(null); }
  backdrop(e: MouseEvent) { if (e.target === e.currentTarget) this.close(); }

  async save() {
    const t = this.type(), nm = this.name().trim(), amt = parseNum(this.amount()), ym = this.ym();
    if ((t === 'bill' || t === 'sudden') && !nm) return this.err.set('Add what it was.');
    if (this.isPerson()) {
      if (!this.person()) return this.err.set('Choose a person.');
      if (this.person() === '__new' && !this.newPerson().trim()) return this.err.set('Add the new person’s name.');
    }
    if (!amt) return this.err.set('Add an amount above ₹0.');
    const due = this.due() ? Number(this.due()) : null;
    if (t === 'bill' && due !== null && (!Number.isInteger(due) || due < 1 || due > 31)) return this.err.set('Due day must be between 1 and 31.');
    if (t === 'sudden' && (this.date() < this.minDate() || this.date() > this.maxDate())) return this.err.set(`Pick a date inside ${ymLabel(ym)}.`);

    let request;
    let path: string;
    if (t === 'bill') {
      request = this.api.addBill(ym, { name: nm, category: this.category(), amount: amt, status: this.status(), dueDay: due });
      path = '/pay';
    } else if (t === 'sudden') {
      request = this.api.addSudden(ym, { name: nm, amount: amt, mode: this.mode(), date: this.date() });
      path = '/sudden';
    } else {
      request = this.api.addEntry(ym, {
        direction: t, amount: amt, reason: nm,
        ...(this.person() === '__new' ? { newPersonName: this.newPerson().trim() } : { personId: this.person() }),
      });
      path = '/people';
    }
    this.busy.set(true);
    const error = await this.store.run(request, { quiet: true });
    this.busy.set(false);
    if (error) return this.err.set(error);
    this.store.ym.set(ym);
    this.close();
    this.router.navigate([path], { queryParams: this.isPerson() ? { tab: t } : {} });
  }

  protected readonly inr = inr;
}
