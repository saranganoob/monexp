import { AfterViewInit, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../core/app-store';
import { Api } from '../../core/api.service';
import { FULL_MONTHS, MONTHS, inr, parseNum, todayIso } from '../../core/utils/format';
import { Busy } from '../../shared/directives/busy';
import { Icon } from '../../shared/ui/icon/icon';

const SAVE_KEY = 'friend-buy';
const NEW_PERSON = '__new__';

/**
 * "Bought for a friend": something a friend bought on my credit card, which they pay me back –
 * all at once, or as an EMI on my card ("X of Y", Mark received each month). Extra charges
 * (EMI interest, a one-time fee) are paid by the friend unless I choose to absorb them.
 */
@Component({
  selector: 'app-friend-buy-dialog',
  imports: [ReactiveFormsModule, Icon, Busy],
  templateUrl: './friend-buy-dialog.html',
  styleUrls: ['../add-expense-dialog/add-expense-dialog.scss', './friend-buy-dialog.scss'],
  host: { '(document:keydown.escape)': 'close()' },
})
export class FriendBuyDialog implements AfterViewInit {
  protected store = inject(AppStore);
  private api = inject(Api);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly saveKey = SAVE_KEY;
  protected readonly newPerson = NEW_PERSON;
  protected readonly today = todayIso();
  protected readonly months = FULL_MONTHS;
  protected readonly error = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    personId: [''],
    newName: ['', Validators.maxLength(60)],
    item: ['', Validators.maxLength(80)],
    cardId: [this.store.friendBuyDialog()?.cardId ?? ''],
    price: [''],
    date: [this.today],
    type: ['once' as 'once' | 'emi'],
    monthly: [''],
    count: [''],
    startMonth: [Number(this.today.slice(5, 7)) - 1],
    startYear: [Number(this.today.slice(0, 4))],
    fee: [''],
    chargesBy: ['friend' as 'friend' | 'me'], // the friend pays the charges unless switched
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly openCards = computed(() => this.store.cards().filter((c) => !c.closedOn));
  protected readonly isEmi = computed(() => this.v().type === 'emi');
  protected readonly years = computed(() => { const y = Number(this.today.slice(0, 4)); return [y - 2, y - 1, y, y + 1]; });
  /** The friend's name, for the summary. */
  protected readonly who = computed(() => {
    const v = this.v();
    if (v.personId === NEW_PERSON) return v.newName?.trim() || 'Your friend';
    return this.store.people().find((p) => p.id === v.personId)?.name ?? 'Your friend';
  });

  /** What goes on the card and what the friend pays back – worked out as you type. */
  protected readonly plan = computed(() => {
    const v = this.v();
    const price = parseNum(v.price), fee = parseNum(v.fee), friendPays = v.chargesBy === 'friend';
    if (!price) return null;
    if (!this.isEmi()) {
      const owed = price + (friendPays ? fee : 0);
      return {
        interest: 0, fee, hasCharges: fee > 0,
        lines: [
          `${inr(price + fee)} on the card${fee ? ` (${inr(price)} + ${inr(fee)} charges)` : ''}`,
          `${this.who()} owes you ${inr(owed)}${fee && !friendPays ? ` – you cover the ${inr(fee)} charges` : ''}`,
          'Can be paid back all at once or in parts (People → Part received).',
        ],
        problem: '',
      };
    }
    const monthly = parseNum(v.monthly), n = parseNum(v.count);
    if (!monthly || !n) return { interest: 0, fee, hasCharges: fee > 0, lines: [], problem: '' };
    if (n < 2 || n > 120) return { interest: 0, fee, hasCharges: false, lines: [], problem: 'Number of EMIs must be between 2 and 120.' };
    if (monthly * n < price) return { interest: 0, fee, hasCharges: false, lines: [], problem: `${n} × ${inr(monthly)} is less than the price – check the EMI amount.` };
    const interest = monthly * n - price;
    const repay = friendPays ? monthly : Math.floor(price / n);
    const start = `${MONTHS[Number(v.startMonth)]} ${v.startYear}`;
    const extra = interest + fee;
    return {
      interest, fee, hasCharges: extra > 0,
      lines: [
        `Card: ${n} EMIs of ${inr(monthly)} from ${start}${fee ? ` + ${inr(fee)} fee on the first bill` : ''}`,
        `${this.who()} pays you ${inr(repay)} a month × ${n}` + (friendPays && fee ? ` + the ${inr(fee)} fee` : ''),
        extra ? (friendPays ? `Charges ${inr(extra)} (interest ${inr(interest)}${fee ? ` + fee ${inr(fee)}` : ''}) – paid by ${this.who()}`
          : `You cover ${inr(extra)} of charges (interest ${inr(interest)}${fee ? ` + fee ${inr(fee)}` : ''})`) : 'No-cost EMI – no extra charges',
        'Each month shows under People with “Mark received” and “X of Y”.',
      ],
      problem: '',
    };
  });

  ngAfterViewInit() {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('#fbPerson')?.focus());
  }

  close() { this.store.friendBuyDialog.set(null); }
  backdrop(e: MouseEvent) { if (e.target === e.currentTarget) this.close(); }
  protected setType(t: 'once' | 'emi') { this.form.controls.type.setValue(t); }
  protected setCharges(by: 'friend' | 'me') { this.form.controls.chargesBy.setValue(by); }

  private validate(): string {
    const v = this.form.getRawValue();
    if (!v.personId) return 'Choose the friend it was bought for.';
    if (v.personId === NEW_PERSON && !v.newName.trim()) return 'Type the friend’s name.';
    if (!v.item.trim()) return 'Add what was bought, e.g. Phone.';
    if (!v.cardId) return 'Choose the card it was charged to.';
    if (!parseNum(v.price)) return 'Add the price.';
    if (!v.date || v.date > this.today) return 'Pick the date it was bought – today or earlier.';
    if (this.isEmi()) {
      if (!parseNum(v.monthly)) return 'Add the EMI amount per month (from the card’s EMI details).';
      if (!parseNum(v.count)) return 'Add the number of EMIs.';
    }
    return this.plan()?.problem ?? '';
  }

  async save() {
    const problem = this.validate();
    if (problem) return this.error.set(problem);
    const v = this.form.getRawValue();
    const body = {
      ...(v.personId === NEW_PERSON ? { newPersonName: v.newName.trim() } : { personId: v.personId }),
      item: v.item.trim(), cardId: v.cardId, price: parseNum(v.price), date: v.date, type: v.type,
      fee: parseNum(v.fee), chargesBy: v.chargesBy,
      ...(this.isEmi() ? {
        monthly: parseNum(v.monthly), months: parseNum(v.count),
        startYm: `${v.startYear}-${String(Number(v.startMonth) + 1).padStart(2, '0')}`,
      } : {}),
    };
    const err = await this.store.run(() => this.api.addFriendPurchase(body), { quiet: true, key: SAVE_KEY });
    if (err) return this.error.set(err);
    this.close();
  }
}
