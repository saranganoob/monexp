import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Installment, Plan } from '../../../core/models';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { ProgressRing } from '../../../shared/ui/progress-ring/progress-ring';
import { installmentTone } from '../../../shared/utils/installment-tone';
import { PlanForm } from '../plan-form/plan-form';

/** One plan or card EMI: progress ring, amounts and closing month. Plans can be edited here. */
@Component({
  selector: 'app-installment-card',
  imports: [RouterLink, InrPipe, YmPipe, ProgressRing, PlanForm],
  templateUrl: './installment-card.html',
  styleUrl: './installment-card.scss',
})
export class InstallmentCard {
  readonly item = input.required<Installment>();
  readonly plan = input<Plan | null>(null);
  readonly editing = input(false);
  readonly edit = output<void>();
  readonly closed = output<void>();
  readonly remove = output<void>();

  protected readonly n = computed(() => Math.max(0, this.item().n));
  protected readonly pct = computed(() => (this.n() / this.item().total) * 100);
  protected readonly tone = computed(() => installmentTone(this.item()));
}
