import { Component, computed, input } from '@angular/core';

/** Round initial, e.g. "V" for Vinod. Tones match the design. */
@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class Avatar {
  readonly name = input.required<string>();
  readonly tone = input<'blue' | 'orange' | 'grey' | 'navy'>('blue');
  readonly size = input<'sm' | 'md'>('md');
  protected readonly initial = computed(() => (this.name().trim().charAt(0) || '?').toUpperCase());
}
