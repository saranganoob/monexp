import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Api } from '../../core/api.service';
import { CardView, EmiView } from '../../core/models';
import { STAT, addMonths, chipStyle, fmtInput, inr, parseNum, segStyle, val, ymIndex, ymShort } from '../../core/format';
import { CardBillEditor } from '../../shared/card-bill-editor';

@Component({
  selector: 'app-credit-cards',
  imports: [RouterLink, CardBillEditor],
  templateUrl: './credit-cards.html',
})
export class CreditCardsPage {
  protected store = inject(Store);
  private api = inject(Api);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected inr = inr;
  protected val = val;
  protected fmtInput = fmtInput;
  protected segStyle = segStyle;
  protected ymShort = ymShort;

  protected m = this.store.month;
  protected editingCard = signal<string | null>(null);

  /** Cards with a bill this month or an EMI running. */
  protected tiles = computed(() => (this.m()?.cards ?? []).filter((c) => c.billId || c.emis.length).map((c) => {
    const paid = c.billStatus === 'paid';
    return { c, paid, chip: chipStyle(paid ? STAT.paid : STAT.unpaid), name: c.name + (c.closedOn ? ' · closed' : '') };
  }));
  protected sums = computed(() => this.tiles().reduce((s, t) => ({
    total: s.total + t.c.total, spends: s.spends + t.c.spends, mine: s.mine + t.c.myEmis, friend: s.friend + t.c.friendEmis,
  }), { total: 0, spends: 0, mine: 0, friend: 0 }));

  // ---- friends' EMIs that haven't finished ----
  protected friendRows = computed(() => {
    const I = ymIndex(this.store.ym());
    const cards = new Map(this.store.cards().map((c) => [c.id, c.name]));
    const people = new Map(this.store.people().map((p) => [p.id, p.name]));
    const doneNow = new Set((this.m()?.receivables ?? []).filter((r) => r.emiId && r.status === 'done').map((r) => r.emiId));
    return this.store.emis().filter((e) => e.forWho === 'friend' && ymIndex(e.startYm) + e.totalMonths - 1 >= I).map((e) => {
      const n = I - ymIndex(e.startYm) + 1;
      const left = e.totalMonths - Math.max(n - 1, 0) - (n >= 1 && doneNow.has(e.id) ? 1 : 0);
      const who = people.get(e.personId ?? '') ?? 'Friend';
      const end = ymShort(addMonths(e.startYm, e.totalMonths - 1));
      return {
        id: e.id, initial: who.charAt(0).toUpperCase(), title: `${who} · ${e.item}`,
        sub: `On ${cards.get(e.cardId) ?? 'card'} · ${n >= 1 ? `installment ${n} of ${e.totalMonths}` : `starts ${ymShort(e.startYm)}`} · ${e.monthly ? inr(e.monthly) + '/mo' : 'amount not set'}`,
        left: e.monthly * left, monthly: e.monthly, end,
      };
    });
  });
  protected friendOutstanding = computed(() => this.friendRows().reduce((s, r) => s + r.left, 0));

  // ---- "Add an EMI" form ----
  protected eFor = signal<'me' | 'friend'>('me');
  protected eCard = signal('');
  protected eFriend = signal('');
  protected eItem = signal('');
  protected eMonthly = signal('');
  protected eTotal = signal('');
  protected ePaid = signal('0');
  protected eErr = signal('');
  protected openCards = computed(() => this.store.cards().filter((c) => !c.closedOn));
  protected selectedCard = computed(() => this.eCard() || this.openCards()[0]?.id || '');

  emiBar(e: EmiView) {
    return `height: 100%; border-radius: 999px; background: ${e.forWho === 'friend' ? '#C2410C' : '#102A6B'}; width: ${Math.round((e.n / e.total) * 100)}%`;
  }
  whoStyle(e: EmiView) {
    return 'font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 9px; ' + (e.forWho === 'friend' ? 'background: #FFEDD5; color: #9A3412' : 'background: #EEF0F3; color: #374151');
  }
  leftAmt(e: EmiView) { return e.monthly ? inr(e.monthly * (e.total - e.n + 1)) : '—'; }

  setSpends(c: CardView, e: Event) {
    const v = parseNum(val(e));
    if (v !== c.spends) this.store.run(this.api.setCardBill(this.store.ym(), c.id, { spends: v }));
  }
  // ---- "Add a new spend" box on each card: existing + new = updated ----
  protected addText = signal<Partial<Record<string, string>>>({});
  protected addErr = signal<Record<string, string>>({});
  setAddText(c: CardView, e: Event) {
    this.addText.update((m) => ({ ...m, [c.id]: val(e) }));
    this.addErr.update((m) => ({ ...m, [c.id]: '' }));
  }
  addPreview(c: CardView) {
    const add = parseNum(this.addText()[c.id] ?? '');
    return add ? `${inr(c.spends)} + ${inr(add)} = ${inr(c.spends + add)}` : '';
  }
  async addSpend(c: CardView) {
    const add = parseNum(this.addText()[c.id] ?? '');
    if (!add) return this.addErr.update((m) => ({ ...m, [c.id]: 'Enter an amount above ₹0 to add.' }));
    const error = await this.store.run(this.api.setCardBill(this.store.ym(), c.id, { add }), { quiet: true });
    if (error) return this.addErr.update((m) => ({ ...m, [c.id]: error }));
    this.addText.update((m) => ({ ...m, [c.id]: '' }));
  }

  setMonthly(e: EmiView, ev: Event) {
    const v = parseNum(val(ev));
    if (v !== e.monthly) this.store.run(this.api.updateEmi(e.id, { monthly: v }));
  }
  removeEmi(e: EmiView) { this.store.run(this.api.deleteEmi(e.id)); }
  toggleRecv(e: EmiView) { this.store.run(this.api.setEmiMonth(this.store.ym(), e.id, { received: e.received === 'done' ? 'pending' : 'done' })); }
  togglePaid(c: CardView) {
    if (c.billId) this.store.run(this.api.updateBill(c.billId, { status: c.billStatus === 'paid' ? 'unpaid' : 'paid' }));
  }
  addHere(c: CardView) {
    this.eCard.set(c.id);
    const item = this.el.nativeElement.querySelector('#eItem') as HTMLInputElement | null;
    item?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item?.focus({ preventScroll: true });
  }

  async addEmi() {
    const item = this.eItem().trim(), mo = parseNum(this.eMonthly()), tot = parseNum(this.eTotal()), pd = parseNum(this.ePaid());
    if (!item) return this.eErr.set('Add what was bought.');
    if (this.eFor() === 'friend' && !this.eFriend()) return this.eErr.set('Choose who this EMI is for, or add them with “+ Add a new person”.');
    if (!mo) return this.eErr.set('Add the EMI amount per month.');
    if (!tot) return this.eErr.set('Add the total number of months.');
    if (pd >= tot) return this.eErr.set('Already-paid installments must be fewer than the total.');
    const error = await this.store.run(this.api.addEmi({
      cardId: this.selectedCard(), item, forWho: this.eFor(), personId: this.eFor() === 'friend' ? this.eFriend() : null,
      monthly: mo, totalMonths: tot, atYm: this.store.ym(), alreadyPaid: pd,
    }), { quiet: true });
    if (error) return this.eErr.set(error);
    this.eItem.set(''); this.eFriend.set(''); this.eMonthly.set(''); this.eTotal.set(''); this.ePaid.set('0'); this.eErr.set('');
  }
}

