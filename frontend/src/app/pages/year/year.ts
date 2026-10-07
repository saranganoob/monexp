import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '../../core/store';
import { Api, errorMessage } from '../../core/api.service';
import { YearView } from '../../core/models';
import { FULL_MONTHS, MONTHS, inr, ymMonth0, ymYear } from '../../core/format';

const CAT_COLORS: Record<string, string> = { cc: '#102A6B', fam: '#2F5BD3', house: '#5B7FE0', sub: '#8EA8EC', inv: '#BFD0F7', sudden: '#9A3412' };

@Component({
  selector: 'app-year',
  templateUrl: './year.html',
})
export class YearPage {
  private store = inject(Store);
  private api = inject(Api);
  private router = inject(Router);
  protected inr = inr;

  protected year = computed(() => ymYear(this.store.ym()));
  protected data = signal<YearView | null>(null);
  protected err = signal('');

  protected bars = computed(() => {
    const d = this.data();
    if (!d) return [];
    const sel = ymMonth0(this.store.ym());
    const max = Math.max(1, ...d.months.map((m) => (m.exists ? Math.max(m.budget, m.spent) : 0)));
    return d.months.map((m, i) => ({
      ym: m.ym, label: MONTHS[i], has: m.exists,
      aria: `Open ${FULL_MONTHS[i]} ${d.year}` + (m.exists ? `, budget ${inr(m.budget)}, spent ${inr(m.spent)}` : ', no data'),
      budget: m.exists ? `width: 18px; border-radius: 6px 6px 0 0; background: #BFD0F7; height: ${Math.round((m.budget / max) * 180)}px` : '',
      spent: m.exists ? `width: 18px; border-radius: 6px 6px 0 0; background: #102A6B; height: ${Math.round((m.spent / max) * 180)}px` : '',
      labelStyle: `font-size: 13px; font-weight: ${i === sel ? 800 : 600}; color: ${i === sel ? '#1D4ED8' : '#374151'}`,
    }));
  });

  protected cats = computed(() => {
    const d = this.data();
    if (!d) return [];
    const max = Math.max(1, ...d.categories.map((c) => c.total));
    return d.categories.map((c) => ({
      ...c, bar: `height: 100%; border-radius: 999px; background: ${CAT_COLORS[c.key] ?? '#2F5BD3'}; width: ${Math.round((c.total / max) * 100)}%`,
    }));
  });

  constructor() {
    effect(async () => {
      const y = this.year();
      this.store.version();
      try { this.data.set(await this.api.year(y)); this.err.set(''); } catch (e) { this.err.set(errorMessage(e)); }
    });
  }

  open(ym: string) {
    this.store.ym.set(ym);
    this.router.navigateByUrl('/');
  }
}
