import { Component, effect, inject, signal } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { Api } from '../../core/api.service';
import { Installment } from '../../core/models';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { BudgetCard } from './budget-card/budget-card';
import { ClosingNext } from './closing-next/closing-next';
import { PeopleOweYou } from './people-owe-you/people-owe-you';
import { PaySummary } from './pay-summary/pay-summary';
import { StillToPay } from './still-to-pay/still-to-pay';

@Component({
  selector: 'app-overview',
  imports: [InrPipe, BudgetCard, PaySummary, StillToPay, PeopleOweYou, ClosingNext],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class OverviewPage {
  private store = inject(AppStore);
  private api = inject(Api);
  protected readonly month = this.store.month;
  protected readonly installments = signal<Installment[]>([]);

  constructor() {
    effect(async () => {
      const ym = this.store.ym();
      this.store.version();
      try { this.installments.set(await this.api.installments(ym)); } catch { this.installments.set([]); }
    });
  }
}
