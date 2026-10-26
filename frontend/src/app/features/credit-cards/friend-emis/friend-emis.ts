import { Component, computed, inject } from '@angular/core';
import { AppStore } from '../../../core/app-store';
import { ymIndex } from '../../../core/utils/format';
import { endIdx, instAt, leftFrom } from '../../../core/utils/installments';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Avatar } from '../../../shared/ui/avatar/avatar';

/** Every EMI I pay for a friend (on a card or from the bank) that hasn't finished, with what's still to come back. */
@Component({
  selector: 'app-friend-emis',
  imports: [InrPipe, YmPipe, Avatar],
  templateUrl: './friend-emis.html',
  styleUrl: './friend-emis.scss',
})
export class FriendEmis {
  private store = inject(AppStore);

  protected readonly rows = computed(() => {
    const ym = this.store.ym(), I = ymIndex(ym);
    const cards = new Map(this.store.cards().map((c) => [c.id, c.name]));
    const people = new Map(this.store.people().map((p) => [p.id, p.name]));
    const receivedNow = new Set((this.store.month()?.receivables ?? []).filter((r) => r.emiId && r.status === 'done').map((r) => r.emiId));
    return this.store.emis()
      .map((e) => ({ e, plan: { startIdx: ymIndex(e.startYm), total: e.totalMonths, freq: e.freq ?? 'monthly' } as const }))
      .filter(({ e, plan }) => e.forWho === 'friend' && leftFrom(plan, I) > 0)
      .map(({ e, plan }) => {
        const at = instAt(plan, I);
        const paymentsLeft = leftFrom(plan, I) - (at.due && receivedNow.has(e.id) ? 1 : 0);
        const last = endIdx(plan);
        return {
          id: e.id, who: people.get(e.personId ?? '') ?? 'Friend', item: e.item,
          from: e.cardId ? `On ${cards.get(e.cardId) ?? 'card'}` : 'From bank / cash',
          n: I < plan.startIdx ? 0 : at.n, total: e.totalMonths, startYm: e.startYm, monthly: e.monthly, yearly: plan.freq === 'yearly',
          left: e.monthly * paymentsLeft, endYm: `${Math.floor(last / 12)}-${String((last % 12) + 1).padStart(2, '0')}`,
        };
      });
  });
  protected readonly outstanding = computed(() => this.rows().reduce((s, r) => s + r.left, 0));
}
