import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { Api, errorMessage } from '../../core/api.service';
import { YearView } from '../../core/models';
import { ymMonth0, ymYear } from '../../core/utils/format';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { CategoryBars } from './category-bars/category-bars';
import { MonthBars } from './month-bars/month-bars';

@Component({
  selector: 'app-year-view',
  imports: [InrPipe, MonthBars, CategoryBars],
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

  constructor() {
    effect(async () => {
      const y = this.year();
      this.store.version();
      try { this.data.set(await this.api.year(y)); this.error.set(''); } catch (e) { this.error.set(errorMessage(e)); }
    });
  }

  open(ym: string) {
    this.store.ym.set(ym);
    this.router.navigateByUrl('/');
  }
}
