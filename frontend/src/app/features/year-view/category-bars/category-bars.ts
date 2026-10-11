import { Component, computed, input } from '@angular/core';
import { YearView } from '../../../core/models';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

/** "Where the year's money went" – one bar per group. */
@Component({
  selector: 'app-category-bars',
  imports: [InrPipe],
  templateUrl: './category-bars.html',
  styleUrl: './category-bars.scss',
})
export class CategoryBars {
  readonly data = input.required<YearView>();
  protected readonly rows = computed(() => {
    const cats = this.data().categories;
    const max = Math.max(1, ...cats.map((c) => c.total));
    return cats.map((c) => ({ ...c, pct: (c.total / max) * 100 }));
  });
}
