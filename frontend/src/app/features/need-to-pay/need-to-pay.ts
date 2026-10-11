import { Component, computed, inject, signal } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { BillStatus } from '../../core/models';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { YmPipe } from '../../shared/pipes/ym.pipe';
import { Icon } from '../../shared/ui/icon/icon';
import { BillRow } from './bill-row/bill-row';

type Filter = 'all' | BillStatus;

@Component({
  selector: 'app-need-to-pay',
  imports: [InrPipe, YmPipe, Icon, BillRow],
  templateUrl: './need-to-pay.html',
  styleUrl: './need-to-pay.scss',
})
export class NeedToPayPage {
  protected store = inject(AppStore);
  protected readonly month = this.store.month;
  protected readonly filter = signal<Filter>('all');
  /** Only one row edits at a time. */
  protected readonly editing = signal<string | null>(null);

  protected readonly filters = computed(() => {
    const t = this.month()?.totals;
    return [
      { key: 'all' as Filter, label: 'All', count: this.month()?.bills.length ?? 0 },
      { key: 'unpaid' as Filter, label: 'Unpaid', count: t?.unpaidCount ?? 0 },
      { key: 'paid' as Filter, label: 'Paid', count: t?.paidCount ?? 0 },
      { key: 'skipped' as Filter, label: 'Skipped', count: t?.skippedCount ?? 0 },
    ];
  });

  protected readonly groups = computed(() => {
    const m = this.month();
    if (!m) return [];
    return m.categories.map((c) => {
      const all = m.bills.filter((b) => b.category === c.key);
      const live = all.filter((b) => b.status !== 'skipped');
      return {
        key: c.key, label: c.label, total: c.total, liveCount: live.length, allCount: all.length,
        paidCount: live.filter((b) => b.status === 'paid').length,
        bills: all.filter((b) => this.filter() === 'all' || b.status === this.filter()),
      };
    }).filter((g) => g.bills.length);
  });

  cardOf(cardId: string | null) {
    return cardId ? this.month()?.cards.find((c) => c.id === cardId) ?? null : null;
  }
}
