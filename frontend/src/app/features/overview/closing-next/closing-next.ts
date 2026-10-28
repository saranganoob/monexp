import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Installment } from '../../../core/models';
import { ProgressBar } from '../../../shared/ui/progress-bar/progress-bar';
import { installmentTone } from '../../../shared/utils/installment-tone';
import { YmPipe } from '../../../shared/pipes/ym.pipe';

/** The four installments that finish soonest. */
@Component({
  selector: 'app-closing-next',
  imports: [RouterLink, ProgressBar, YmPipe],
  templateUrl: './closing-next.html',
  styleUrl: './closing-next.scss',
})
export class ClosingNext {
  readonly items = input.required<Installment[]>();
  // Ongoing ones (rent, support…) never close, so they're left out here.
  protected readonly top = computed(() => this.items().filter((i) => i.total != null).slice(0, 4).map((i) => ({
    i, n: Math.max(0, i.n), pct: (Math.max(0, i.n) / i.total!) * 100, tone: installmentTone(i),
  })));
}
