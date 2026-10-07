import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Api } from '../../core/api.service';
import { Bill, Installment } from '../../core/models';
import { dueInfo, fmtInput, inr, parseNum, val, ymLabel, ymShort } from '../../core/format';
import { personRow } from '../../shared/people-row';
import { toggleEntry } from '../../shared/entry-actions';

@Component({
  selector: 'app-overview',
  imports: [RouterLink],
  templateUrl: './overview.html',
})
export class OverviewPage {
  protected store = inject(Store);
  private api = inject(Api);
  protected inr = inr;
  protected val = val;

  protected m = this.store.month;
  protected label = computed(() => ymLabel(this.store.ym()));
  protected budgetText = signal('');
  protected installments = signal<Installment[]>([]);

  protected upcoming = computed(() => {
    const m = this.m();
    if (!m) return [];
    return m.bills.filter((b) => b.status === 'unpaid')
      .sort((a, b) => (a.dueDay || 99) - (b.dueDay || 99))
      .map((b) => ({ b, due: dueInfo(b, m.ym) }));
  });
  protected recvRows = computed(() => (this.m()?.receivables ?? []).map(personRow));
  protected closingNext = computed(() => this.installments().slice(0, 4).map((p) => {
    const n = Math.max(0, p.n);
    const color = p.incoming ? '#2F5BD3' : p.friend ? '#C2410C' : '#102A6B';
    return {
      name: p.name,
      progress: (n < 1 ? `starts ${ymShort(p.startYm)}` : `${n} of ${p.total}`) + ` · ends ${ymShort(p.endYm)}`,
      bar: `height: 100%; width: ${Math.round((n / p.total) * 100)}%; background: ${color}; border-radius: 999px`,
    };
  }));
  protected paidBar = computed(() => `height: 100%; width: ${this.m()?.totals.paidPct ?? 0}%; background: #0B7A55; border-radius: 999px`);

  constructor() {
    effect(() => this.budgetText.set(fmtInput(this.m()?.budget)));
    effect(async () => {
      const ym = this.store.ym();
      this.store.version();
      try { this.installments.set(await this.api.installments(ym)); } catch { this.installments.set([]); }
    });
  }

  balanceColor(n: number) { return n < 0 ? '#A3201A' : '#0B6B4B'; }

  saveBudget() {
    const v = parseNum(this.budgetText());
    if (v === this.m()?.budget) return;
    this.store.run(this.api.setBudget(this.store.ym(), v));
  }

  markPaid(b: Bill) { this.store.run(this.api.updateBill(b.id, { status: 'paid' })); }
  toggleRecv = (r: Parameters<typeof toggleEntry>[2]) => toggleEntry(this.api, this.store, r);
}
