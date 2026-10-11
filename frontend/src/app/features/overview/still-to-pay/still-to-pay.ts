import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Bill, MonthData } from '../../../core/models';
import { dueInfo } from '../../../core/utils/format';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';

/** Unpaid bills, soonest due first, each with "Mark paid". */
@Component({
  selector: 'app-still-to-pay',
  imports: [RouterLink, InrPipe, YmPipe],
  templateUrl: './still-to-pay.html',
  styleUrl: './still-to-pay.scss',
})
export class StillToPay {
  private store = inject(AppStore);
  private api = inject(Api);
  readonly month = input.required<MonthData>();

  protected readonly rows = computed(() => {
    const m = this.month();
    return m.bills.filter((b) => b.status === 'unpaid')
      .sort((a, b) => (a.dueDay || 99) - (b.dueDay || 99))
      .map((b) => ({ b, due: dueInfo(b, m.ym) }));
  });

  markPaid(b: Bill) { this.store.run(this.api.updateBill(b.id, { status: 'paid' })); }
}
