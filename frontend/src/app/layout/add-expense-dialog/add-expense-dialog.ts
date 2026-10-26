import { AfterViewInit, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AddType, AppStore } from '../../core/app-store';
import { Api } from '../../core/api.service';
import { FULL_MONTHS, defaultDate, firstDate, lastDate, makeYm, parseNum, yearOptions, ymLabel, ymMonth0, ymYear } from '../../core/utils/format';
import { firstError, rupees, wholeNumber } from '../../core/forms/validators';
import { BILL_GROUPS } from '../../shared/components/bill-editor/bill-editor';
import { Icon } from '../../shared/ui/icon/icon';
import { Busy } from '../../shared/directives/busy';
import { LangHint } from '../../shared/ui/lang-hint/lang-hint';
import { HintKey } from '../../core/i18n/home-language';

const SAVE_KEY = 'add-expense';
const TYPES: { key: AddType; label: string; sub: string; hint?: HintKey }[] = [
  { key: 'bill', label: 'Bill / expense', sub: 'Goes to Need to pay' },
  { key: 'sudden', label: 'Sudden spend', sub: 'Unplanned, one-off' },
  { key: 'in', label: 'They owe me', sub: 'You lent or paid', hint: 'theyOweMe' },
  { key: 'out', label: 'I owe them', sub: 'You borrowed', hint: 'iOweThem' },
];

/** "Add expense" – a bill, sudden spend or people entry, to any month. */
@Component({
  selector: 'app-add-expense-dialog',
  imports: [ReactiveFormsModule, Icon, Busy, LangHint],
  templateUrl: './add-expense-dialog.html',
  styleUrl: './add-expense-dialog.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class AddExpenseDialog implements AfterViewInit {
  protected store = inject(AppStore);
  private api = inject(Api);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private fb = inject(NonNullableFormBuilder);

  protected readonly types = TYPES;
  protected readonly months = FULL_MONTHS;
  protected readonly groups = BILL_GROUPS;
  protected readonly error = signal('');
  protected readonly saveKey = SAVE_KEY;

  protected readonly form = this.fb.group({
    type: [this.store.dialog()?.type ?? ('bill' as AddType)],
    month: [ymMonth0(this.store.ym())],
    year: [ymYear(this.store.ym())],
    person: [''],
    newPerson: [''],
    name: ['', Validators.maxLength(120)],
    amount: ['', rupees(1)],
    category: ['fam'],
    dueDay: ['', wholeNumber(1, 31)],
    status: ['unpaid'],
    mode: ['UPI'],
    date: [defaultDate(this.store.ym())],
    /** Keep the dialog open after saving, ready for the next one. */
    again: [false],
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly type = computed(() => this.v().type as AddType);
  protected readonly isPerson = computed(() => this.type() === 'in' || this.type() === 'out');
  protected readonly ym = computed(() => makeYm(Number(this.v().year), Number(this.v().month)));
  protected readonly years = computed(() => yearOptions(Number(this.v().year)));
  protected readonly minDate = computed(() => firstDate(this.ym()));
  protected readonly maxDate = computed(() => lastDate(this.ym()));
  protected readonly modeOptions = computed(() => [
    { value: 'UPI', label: 'UPI' }, { value: 'Cash', label: 'Cash' }, { value: 'Bank account', label: 'Bank account / debit card' },
    ...this.store.cards().filter((c) => !c.closedOn).map((c) => ({ value: 'card:' + c.id, label: `${c.name} credit card` })),
  ]);
  protected readonly hint = computed(() => {
    const viewingIt = this.ym() === this.store.ym();
    return !viewingIt || this.store.view()?.exists
      ? 'It’s saved under this month — change the month or year above if needed.'
      : `${ymLabel(this.ym())} isn’t set up yet. Saving will create it, carrying over your recurring bills from the latest earlier month.`;
  });
  protected readonly nameLabel = computed(() => ({ bill: 'What is it?', sudden: 'What was it?', in: 'What for? (optional)', out: 'What for? (optional)' })[this.type()]);
  protected readonly namePlaceholder = computed(() => ({ bill: 'e.g. Electricity bill', sudden: 'e.g. Bike service', in: 'e.g. Movie tickets', out: 'e.g. Movie tickets' })[this.type()]);
  protected readonly saveLabel = computed(() => ({ bill: 'Add bill', sudden: 'Add spend', in: 'Add — they owe me', out: 'Add — I owe them' })[this.type()]);

  constructor() {
    // A new month/year resets the date to a sensible day inside it.
    this.form.controls.month.valueChanges.subscribe(() => this.form.controls.date.setValue(defaultDate(this.ym())));
    this.form.controls.year.valueChanges.subscribe(() => this.form.controls.date.setValue(defaultDate(this.ym())));
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  ngAfterViewInit() {
    this.focusFirst();
  }

  private focusFirst() {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(this.isPerson() ? '#dPerson' : '#dName')?.focus());
  }

  close() { this.store.dialog.set(null); }
  backdrop(e: MouseEvent) { if (e.target === e.currentTarget) this.close(); }

  private validate(): string {
    const v = this.form.getRawValue(), t = v.type;
    if ((t === 'bill' || t === 'sudden') && !v.name.trim()) return 'Add what it was.';
    if (t === 'in' || t === 'out') {
      if (!v.person) return 'Choose a person.';
      if (v.person === '__new' && !v.newPerson.trim()) return 'Add the new person’s name.';
    }
    const fieldError = firstError(this.form, {
      amount: { required: 'Add an amount above ₹0.', min: 'Add an amount above ₹0.', rupees: 'Amount must be whole rupees.' },
      ...(t === 'bill' ? { dueDay: { range: 'Due day must be between 1 and 31.' } } : {}),
    });
    if (fieldError) return fieldError;
    if (t === 'sudden' && (v.date < this.minDate() || v.date > this.maxDate())) return `Pick a date inside ${ymLabel(this.ym())}.`;
    return '';
  }

  async save() {
    this.form.markAllAsTouched();
    const problem = this.validate();
    if (problem) return this.error.set(problem);

    const v = this.form.getRawValue(), ym = this.ym(), amount = parseNum(v.amount), name = v.name.trim();
    let request, path: string;
    if (v.type === 'bill') {
      request = () => this.api.addBill(ym, { name, category: v.category, amount, status: v.status, dueDay: v.dueDay ? Number(v.dueDay) : null });
      path = '/pay';
    } else if (v.type === 'sudden') {
      request = () => this.api.addSudden(ym, { name, amount, mode: v.mode, date: v.date });
      path = '/sudden';
    } else {
      request = () => this.api.addEntry(ym, {
        direction: v.type as 'in' | 'out', amount, reason: name,
        ...(v.person === '__new' ? { newPersonName: v.newPerson.trim() } : { personId: v.person }),
      });
      path = '/people';
    }
    const err = await this.store.run(request, { quiet: true, key: SAVE_KEY });
    if (err) return this.error.set(err);
    this.store.ym.set(ym);
    if (v.again) {
      // Ready for the next one: keep type, month, category, payment mode and person; clear the rest.
      this.form.patchValue({ name: '', amount: '', dueDay: '', newPerson: '' });
      for (const c of ['name', 'amount', 'dueDay', 'newPerson'] as const) this.form.controls[c].markAsUntouched();
      this.error.set('');
      this.focusFirst();
      return;
    }
    this.close();
    this.router.navigate([path], { queryParams: this.isPerson() ? { tab: v.type } : {} });
  }
}
