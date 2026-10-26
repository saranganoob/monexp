import { Component, computed, effect, inject, signal } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { Api, errorMessage } from '../../core/api.service';
import { Installment, Plan } from '../../core/models';
import { InstallmentCard } from './installment-card/installment-card';
import { PlanForm } from './plan-form/plan-form';
import { Icon } from '../../shared/ui/icon/icon';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';

@Component({
  selector: 'app-installments',
  imports: [InstallmentCard, PlanForm, Icon, Skeleton],
  templateUrl: './installments.html',
  styleUrl: './installments.scss',
})
export class InstallmentsPage {
  protected store = inject(AppStore);
  private api = inject(Api);
  protected readonly list = signal<Installment[]>([]);
  protected readonly plans = signal<Plan[]>([]);
  protected readonly error = signal('');
  protected readonly editing = signal<string | null>(null);
  /** False until the first list arrives – placeholders show meanwhile. */
  protected readonly loaded = signal(false);

  protected readonly cards = computed(() => this.list().map((i) => ({
    i, plan: i.type === 'plan' ? this.plans().find((p) => p.id === i.id) ?? null : null,
  })));

  constructor() {
    effect(async () => {
      const ym = this.store.ym();
      this.store.version();
      try {
        const [list, plans] = await Promise.all([this.api.installments(ym), this.api.plans()]);
        this.list.set(list);
        this.plans.set(plans);
        this.loaded.set(true);
        this.error.set('');
      } catch (e) {
        this.error.set(errorMessage(e));
      }
    });
  }

  remove(i: Installment, plan: Plan | null) {
    const key = `remove:${i.id}`;
    if (plan) this.store.run(() => this.api.deletePlan(plan.id, this.store.ym()), { key });
    else this.store.run(() => this.api.deleteEmi(i.id), { key });
  }
}
