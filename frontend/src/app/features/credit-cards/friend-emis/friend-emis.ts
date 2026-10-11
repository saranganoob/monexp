import { Component, computed, inject } from '@angular/core';
import { AppStore } from '../../../core/app-store';
import { addMonths, ymIndex } from '../../../core/utils/format';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Avatar } from '../../../shared/ui/avatar/avatar';

/** Every friend's EMI on my cards that hasn't finished, with what's still to come back. */
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
      .filter((e) => e.forWho === 'friend' && ymIndex(e.startYm) + e.totalMonths - 1 >= I)
      .map((e) => {
        const n = I - ymIndex(e.startYm) + 1;
        const monthsLeft = e.totalMonths - Math.max(n - 1, 0) - (n >= 1 && receivedNow.has(e.id) ? 1 : 0);
        return {
          id: e.id, who: people.get(e.personId ?? '') ?? 'Friend', item: e.item, card: cards.get(e.cardId) ?? 'card',
          n, total: e.totalMonths, startYm: e.startYm, monthly: e.monthly,
          left: e.monthly * monthsLeft, endYm: addMonths(e.startYm, e.totalMonths - 1),
        };
      });
  });
  protected readonly outstanding = computed(() => this.rows().reduce((s, r) => s + r.left, 0));
}
