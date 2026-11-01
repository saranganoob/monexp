import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { Api, errorMessage } from '../../core/api.service';
import { YearView } from '../../core/models';
import { ymMonth0, ymYear } from '../../core/utils/format';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { CategoryBars } from './category-bars/category-bars';
import { MonthBars } from './month-bars/month-bars';
import { SPINNER_DELAY_MS } from '../../core/loading.service';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';

@Component({
  selector: 'app-year-view',
  imports: [InrPipe, MonthBars, CategoryBars, Skeleton],
  templateUrl: './year-view.html',
  styleUrl: './year-view.scss',
})
export class YearViewPage {
  private store = inject(AppStore);
  private api = inject(Api);
  private router = inject(Router);

  protected readonly year = computed(() => ymYear(this.store.ym()));
  protected readonly selectedMonth = computed(() => ymMonth0(this.store.ym()));
  protected readonly data = signal<YearView | null>(null);
  protected readonly error = signal('');
  /** Loading a year has taken over 300ms – show placeholders instead of the previous year. */
  protected readonly slow = signal(false);
  protected readonly showSkeleton = computed(() => this.slow() && this.data()?.year !== this.year());
  /** Daily spends were counted as spending in some month of this year. */
  protected readonly hasDaily = computed(() => !!this.data()?.categories.some((c) => c.key === 'daily'));
  /** Sudden spends were counted as spending in some month of this year (not just a note). */
  protected readonly suddenCounted = computed(() => !!this.data()?.suddenCounted);

  constructor() {
    effect(async () => {
      const y = this.year();
      this.store.version();
      const timer = setTimeout(() => this.slow.set(true), SPINNER_DELAY_MS);
      try { this.data.set(await this.api.year(y)); this.error.set(''); } catch (e) { this.error.set(errorMessage(e)); }
      finally { clearTimeout(timer); this.slow.set(false); }
    });
  }

  open(ym: string) {
    this.store.ym.set(ym);
    this.router.navigateByUrl('/');
  }
}
