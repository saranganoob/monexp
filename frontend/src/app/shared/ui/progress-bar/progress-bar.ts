import { Component, computed, input } from '@angular/core';

export type BarTone = 'green' | 'navy' | 'friend' | 'incoming';

/** Rounded progress bar. `value` is 0–100. */
@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  host: { '[class]': '"size-" + size()' },
})
export class ProgressBar {
  readonly value = input(0);
  readonly tone = input<BarTone>('navy');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Track colour: 'grey' or 'amber' (unpaid part on Overview). */
  readonly track = input<'grey' | 'amber'>('grey');
  readonly label = input('');
  protected readonly pct = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));
}
