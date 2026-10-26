import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { isInstalledApp } from '../../core/utils/platform';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { CardTile } from './card-tile/card-tile';
import { FriendEmis } from './friend-emis/friend-emis';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-credit-cards',
  imports: [RouterLink, InrPipe, CardTile, FriendEmis, Icon],
  templateUrl: './credit-cards.html',
  styleUrl: './credit-cards.scss',
})
export class CreditCardsPage {
  protected store = inject(AppStore);
  protected readonly inApp = isInstalledApp();
  protected readonly month = this.store.month;

  /** Cards with a bill this month, an EMI running, or one starting later. */
  protected readonly cards = computed(() => {
    const ym = this.store.ym();
    return (this.month()?.cards ?? []).filter((c) => c.billId || c.emis.length || this.store.emis().some((e) => e.cardId === c.id && e.startYm > ym));
  });
  protected readonly sums = computed(() => this.cards().reduce(
    (s, c) => ({ total: s.total + c.total, spends: s.spends + c.spends, mine: s.mine + c.myEmis, friend: s.friend + c.friendEmis }),
    { total: 0, spends: 0, mine: 0, friend: 0 },
  ));
}
