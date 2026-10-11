import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Api } from '../../core/api.service';
import { Bill, BillStatus } from '../../core/models';
import { STAT, chipStyle, dueInfo, inr, pillStyle, ymShort } from '../../core/format';
import { CardBillEditor } from '../../shared/card-bill-editor';
import { BillEditor } from '../../shared/bill-editor';

type Filter = 'all' | BillStatus;

@Component({
  selector: 'app-need-to-pay',
  imports: [RouterLink, CardBillEditor, BillEditor],
  templateUrl: './need-to-pay.html',
})
export class NeedToPayPage {
  protected store = inject(Store);
  private api = inject(Api);
  protected inr = inr;
  protected pillStyle = pillStyle;

  protected m = this.store.month;
  protected filter = signal<Filter>('all');
  protected open = signal<Record<string, boolean>>({});
  protected editingCard = signal<string | null>(null);
  protected editingBill = signal<string | null>(null);
  protected monthShort = computed(() => ymShort(this.store.ym()));

  protected filters = computed(() => {
    const t = this.m()?.totals;
    const all = this.m()?.bills.length ?? 0;
    return ([['all', 'All', all], ['unpaid', 'Unpaid', t?.unpaidCount ?? 0], ['paid', 'Paid', t?.paidCount ?? 0], ['skipped', 'Skipped', t?.skippedCount ?? 0]] as [Filter, string, number][]);
  });

  protected groups = computed(() => {
    const m = this.m();
    if (!m) return [];
    return m.categories.map((c) => {
      const all = m.bills.filter((b) => b.category === c.key);
      const live = all.filter((b) => b.status !== 'skipped');
      const paid = live.filter((b) => b.status === 'paid').length;
      const items = all.filter((b) => this.filter() === 'all' || b.status === this.filter()).map((b) => this.row(b));
      return { key: c.key, label: c.label, items, summary: live.length ? `${inr(c.total)} · ${paid}/${live.length} paid` : `${all.length} skipped this month` };
    }).filter((g) => g.items.length);
  });

  private row(b: Bill) {
    const m = this.m()!;
    const di = dueInfo(b, m.ym);
    const s = STAT[b.status === 'unpaid' && di.overdue ? 'overdue' : b.status];
    const card = b.cardId ? m.cards.find((c) => c.id === b.cardId) ?? null : null;
    let sub = b.status === 'skipped' ? b.note || 'Skipped this month' : di.label;
    const breakdown: { label: string; value: string; style: string }[] = [];
    if (card) {
      const plain = 'display: flex; justify-content: space-between; gap: 16px; ';
      for (const e of card.emis) {
        breakdown.push({ label: `${e.item} EMI · ${e.forWho === 'friend' ? e.personName + '’s' : 'mine'} · ${e.n} of ${e.total}`, value: e.amount ? inr(e.amount) : 'amount not set', style: plain + (e.forWho === 'friend' ? 'color: #9A3412' : 'color: #374151') });
      }
      breakdown.push({ label: 'My spends', value: inr(card.spends), style: plain + 'color: #374151' });
      breakdown.push({ label: 'Bill total', value: inr(card.total), style: plain + 'font-weight: 800; border-top: 1px solid #E3E6EB; padding-top: 8px' });
      const friends = card.emis.filter((e) => e.forWho === 'friend').length;
      sub = card.emis.length ? `${card.emis.length} EMI${card.emis.length > 1 ? 's' : ''}${friends ? ` · ${friends} for friends` : ''} + my spends` : 'My spends only';
      if (b.note) sub += ` · ${b.note}`;
    }
    const skipped = b.status === 'skipped', paid = b.status === 'paid';
    return {
      b, card, sub, breakdown, paid, skipped,
      subColor: skipped || card ? '#4B5563' : di.color,
      statusLabel: s.label, chip: chipStyle(s),
      tickStyle: 'width: 44px; height: 44px; flex: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; '
        + (paid ? 'background: #0B7A55; border: 2px solid #0B7A55' : skipped ? 'background: #fff; border: 2px dashed #B6BDC7' : 'background: #fff; border: 2px solid #B6BDC7'),
      nameStyle: 'font-weight: 600; ' + (skipped ? 'text-decoration: line-through; color: #6B7280' : ''),
      amtStyle: 'font-weight: 800; min-width: 88px; text-align: right; ' + (skipped ? 'color: #6B7280' : ''),
      instLabel: b.inst ? `${b.inst.n} of ${b.inst.total} · ${b.inst.total - b.inst.n} left` : '',
    };
  }

  toggle(b: Bill) { this.store.run(this.api.updateBill(b.id, { status: b.status === 'paid' ? 'unpaid' : 'paid' })); }
  skip(b: Bill) { this.store.run(this.api.updateBill(b.id, { status: b.status === 'skipped' ? 'unpaid' : 'skipped' })); }
  remove(b: Bill) { this.store.run(this.api.deleteBill(b.id)); }
  expand(id: string) { this.open.update((o) => ({ ...o, [id]: !o[id] })); }
}
