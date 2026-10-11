import { Component, computed, input, output } from '@angular/core';
import { YearView } from '../../../core/models';
import { FULL_MONTHS, MONTHS, inr } from '../../../core/utils/format';

const BAR_HEIGHT = 180;

/** Budget vs spent bars for each month of the year; click a month to open it. */
@Component({
  selector: 'app-month-bars',
  templateUrl: './month-bars.html',
  styleUrl: './month-bars.scss',
})
export class MonthBars {
  readonly data = input.required<YearView>();
  readonly selected = input(0);
  readonly open = output<string>();

  protected readonly bars = computed(() => {
    const d = this.data();
    const max = Math.max(1, ...d.months.map((m) => (m.exists ? Math.max(m.budget, m.spent) : 0)));
    return d.months.map((m, i) => ({
      ym: m.ym, label: MONTHS[i], has: m.exists, isSelected: i === this.selected(),
      budgetPx: m.exists ? Math.round((m.budget / max) * BAR_HEIGHT) : 0,
      spentPx: m.exists ? Math.round((m.spent / max) * BAR_HEIGHT) : 0,
      aria: `Open ${FULL_MONTHS[i]} ${d.year}` + (m.exists ? `, budget ${inr(m.budget)}, spent ${inr(m.spent)}` : ', no data'),
    }));
  });
}
