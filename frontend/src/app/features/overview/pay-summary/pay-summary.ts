import { Component, input } from '@angular/core';
import { Totals } from '../../../core/models';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { ProgressBar } from '../../../shared/ui/progress-bar/progress-bar';

/** "To pay this month" with Paid / Unpaid / Skipped and the progress bar. */
@Component({
  selector: 'app-pay-summary',
  imports: [InrPipe, ProgressBar],
  templateUrl: './pay-summary.html',
  styleUrl: './pay-summary.scss',
})
export class PaySummary {
  readonly totals = input.required<Totals>();
}
