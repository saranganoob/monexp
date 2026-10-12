import { Component, computed, input } from '@angular/core';
import { BarTone } from '../progress-bar/progress-bar';

const COLORS: Record<BarTone, string> = { green: 'var(--ok)', navy: 'var(--data-1)', friend: 'var(--orange)', incoming: 'var(--data-2)' };

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
    return `conic-gradient(${COLORS[this.tone()]} 0 ${pct}%, var(--hair) ${pct}% 100%)`;
  });
}
