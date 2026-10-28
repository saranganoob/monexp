import { AfterViewInit, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../core/app-store';
import { Api } from '../../core/api.service';
import { Freq } from '../../core/models';
import { FULL_MONTHS, MONTHS, inr, parseNum, ymIndex, ymLabel } from '../../core/utils/format';
import { ONGOING_TOTAL, PlanShape, alreadyPaidBefore, leftFrom, nextDueIdx, paymentsBetween } from '../../core/utils/installments';
import { Busy } from '../../shared/directives/busy';
import { Icon } from '../../shared/ui/icon/icon';

const FIRST_YEAR = 2015;
const LAST_YEAR = 2045;
const MAX_PAYMENTS = 600;
const SAVE_KEY = 'add-emi';

const idxLabel = (i: number, short = true) => `${(short ? MONTHS : FULL_MONTHS)[i % 12]} ${Math.floor(i / 12)}`;

/**
 * "Add EMI / installment": for me or a friend, paid from the bank / cash or a card, monthly or
 * yearly, with a first payment that may be in the past and a number of payments, an end date,
 * or no end at all (rent, support…). The summary works out what's already paid and what's left (core/utils/installments).
 */
@Component({
  selector: 'app-emi-dialog',
  imports: [ReactiveFormsModule, Icon, Busy],
  templateUrl: './emi-dialog.html',
  styleUrls: ['../add-expense-dialog/add-expense-dialog.scss', './emi-dialog.scss'],
  host: { '(document:keydown.escape)': 'close()' },
})
export class EmiDialog implements AfterViewInit {
  protected store = inject(AppStore);
  private api = inject(Api);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private fb = inject(NonNullableFormBuilder);

  protected readonly saveKey = SAVE_KEY;
  protected readonly months = FULL_MONTHS;
  protected readonly years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  protected readonly error = signal('');
  /** The month being viewed – "already paid before …" counts up to here. */
  private readonly I = ymIndex(this.store.ym());

  protected readonly form = this.fb.group({
    forWho: ['me' as 'me' | 'friend'],
    personId: [''],
    item: ['', Validators.maxLength(120)],
    amount: [''],
    paidFrom: [this.store.emiDialog()?.cardId ?? ''], // '' = bank / cash
    freq: ['monthly' as Freq],
    startMonth: [this.I % 12],
    startYear: [Math.floor(this.I / 12)],
    howLong: ['count' as 'count' | 'until' | 'ongoing'],
    count: [''],
    endMonth: [(this.I + 11) % 12],
    endYear: [Math.floor((this.I + 11) / 12)],
    again: [false],
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly openCards = computed(() => this.store.cards().filter((c) => !c.closedOn));
  protected readonly isFriend = computed(() => this.v().forWho === 'friend');
  protected readonly yearly = computed(() => this.v().freq === 'yearly');
  protected readonly amountLabel = computed(() => (this.yearly() ? 'Amount per year (₹)' : 'Amount per month (₹)'));
  protected readonly startIdx = computed(() => Number(this.v().startYear) * 12 + Number(this.v().startMonth));
  protected readonly ongoing = computed(() => this.v().howLong === 'ongoing');

  /** Number of payments from the "How long" answer, or a reason it can't be worked out. */
  private readonly total = computed<{ total: number } | { problem: string } | null>(() => {
    const v = this.v();
    if (v.howLong === 'ongoing') return { total: ONGOING_TOTAL }; // counted as a very long plan, saved with no end
    if (v.howLong === 'count') {
      const raw = String(v.count ?? '').trim();
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) return { problem: 'Number of payments must be a whole number, 1 or more.' };
      if (n > MAX_PAYMENTS) return { problem: `That's more than ${MAX_PAYMENTS} payments – check the number.` };
      return { total: n };
    }
    const end = Number(v.endYear) * 12 + Number(v.endMonth);
    if (end < this.startIdx()) return { problem: 'The last payment can’t be before the first one.' };
    const n = paymentsBetween(this.startIdx(), end, v.freq as Freq);
    if (n > MAX_PAYMENTS) return { problem: `That's more than ${MAX_PAYMENTS} payments – check the dates.` };
    return { total: n };
  });

  protected readonly plan = computed<PlanShape | null>(() => {
    const t = this.total();
    return t && 'total' in t ? { startIdx: this.startIdx(), total: t.total, freq: this.v().freq as Freq } : null;
  });

  /** Live summary lines, or the problem with the dates. */
  protected readonly summary = computed(() => {
    const t = this.total();
    if (t && 'problem' in t) return { problem: t.problem, lines: [] as string[] };
    const p = this.plan();
    if (!p) return { problem: '', lines: [] as string[] };
    const I = this.I;
    const amount = parseNum(this.v().amount);
    if (this.ongoing()) {
      const next = nextDueIdx(p, I)!;
      const paid = alreadyPaidBefore(p, I);
      const lines = [`${p.freq === 'yearly' ? 'Yearly' : 'Monthly'} from ${idxLabel(p.startIdx)} · ongoing, no end date`];
      if (paid) lines.push(`${paid} already paid before ${idxLabel(I)}`);
      lines.push(`Next due ${idxLabel(next, false)}` + (amount ? ` · ${inr(amount)} each time, until you remove it` : ''));
      return { problem: '', lines };
    }
    const end = p.startIdx + (p.total - 1) * (p.freq === 'yearly' ? 12 : 1);
    if (end < I) return { problem: `This plan finished before ${idxLabel(I, false)} – there's nothing left to track.`, lines: [] };
    const paid = alreadyPaidBefore(p, I);
    const left = leftFrom(p, I);
    const next = nextDueIdx(p, I);
    const lines = [`${p.total} ${p.freq} payment${p.total === 1 ? '' : 's'} · ${idxLabel(p.startIdx)} → ${idxLabel(end)}`];
    if (paid) lines.push(`${paid} already paid before ${idxLabel(I)} (counted automatically)`);
    if (next !== null) lines.push(`Next due ${idxLabel(next, false)} · ${left} left` + (amount ? ` · ${inr(amount * left)} remaining` : ''));
    if (amount) lines.push(`Total ${inr(amount * p.total)}`);
    return { problem: '', lines };
  });

  ngAfterViewInit() {
    this.focusFirst();
  }

  close() { this.store.emiDialog.set(null); }
  backdrop(e: MouseEvent) { if (e.target === e.currentTarget) this.close(); }
  protected set<K extends 'forWho' | 'freq' | 'howLong'>(name: K, value: string) {
    this.form.controls[name].setValue(value as never);
  }

  private focusFirst() {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(this.isFriend() ? '#ePerson' : '#eItem')?.focus());
  }

  private validate(): string {
    const v = this.form.getRawValue();
    if (v.forWho === 'friend' && !v.personId) return 'Choose which friend it’s for.';
    if (!v.item.trim()) return 'Add what it is, e.g. Insurance or iPhone.';
    if (!parseNum(v.amount)) return 'Add the amount per payment.';
    if (v.howLong === 'count' && !String(v.count).trim()) return 'Add the number of payments, or pick an end date.';
    return this.summary().problem;
  }

  async save() {
    this.form.markAllAsTouched();
    const problem = this.validate();
    if (problem) return this.error.set(problem);
    const v = this.form.getRawValue();
    const p = this.plan()!;
    const body = {
      cardId: v.paidFrom || null, item: v.item.trim(), forWho: v.forWho, personId: v.forWho === 'friend' ? v.personId : null,
      monthly: parseNum(v.amount), freq: v.freq, ...(this.ongoing() ? { ongoing: true } : { totalMonths: p.total }),
      startYm: `${Math.floor(p.startIdx / 12)}-${String((p.startIdx % 12) + 1).padStart(2, '0')}`,
    };
    const err = await this.store.run(() => this.api.addEmi(body), { quiet: true, key: SAVE_KEY });
    if (err) return this.error.set(err);
    if (v.again) {
      // Ready for the next one: keep who / paid from / how often / dates, clear what and how much.
      this.form.patchValue({ item: '', amount: '' });
      this.form.controls.item.markAsUntouched();
      this.form.controls.amount.markAsUntouched();
      this.error.set('');
      this.focusFirst();
    } else {
      this.close();
    }
  }
}
