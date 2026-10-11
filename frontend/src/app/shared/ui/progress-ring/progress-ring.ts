import { Component, computed, input } from '@angular/core';
import { BarTone } from '../progress-bar/progress-bar';

const COLORS: Record<BarTone, string> = { green: '#0B7A55', navy: '#102A6B', friend: '#C2410C', incoming: '#2F5BD3' };

/** Circular progress with a label in the middle, e.g. "34/40". */
@Component({
  selector: 'app-progress-ring',
  templateUrl: './progress-ring.html',
  styleUrl: './progress-ring.scss',
})
export class ProgressRing {
  readonly value = input(0);
  readonly tone = input<BarTone>('navy');
  readonly text = input('');
  protected readonly background = computed(() => {
    const pct = Math.max(0, Math.min(100, Math.round(this.value())));
    return `conic-gradient(${COLORS[this.tone()]} 0 ${pct}%, #E3E6EB ${pct}% 100%)`;
  });
}
