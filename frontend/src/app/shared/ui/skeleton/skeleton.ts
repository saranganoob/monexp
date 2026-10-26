import { Component, input } from '@angular/core';

/** Shimmering placeholders shown while a page or month is loading (instead of a blank screen). */
@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.scss',
  host: { role: 'status', 'aria-live': 'polite' },
})
export class Skeleton {
  /** 'page' = summary tiles + a list; 'list' = just list rows; 'cards' = a grid of cards. */
  readonly variant = input<'page' | 'list' | 'cards'>('page');
  readonly rows = input(5);
  protected readonly rowList = () => Array.from({ length: this.rows() });
}
