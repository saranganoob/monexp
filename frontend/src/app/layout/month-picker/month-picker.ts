import { Component, computed, inject, input } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { FULL_MONTHS, addMonths, makeYm, yearOptions, ymMonth0, ymYear } from '../../core/utils/format';
import { Icon } from '../../shared/ui/icon/icon';

/** ‹ October ▾ 2026 ▾ › – or just a year picker with mode="year". */
@Component({
  selector: 'app-month-picker',
  imports: [Icon],
  templateUrl: './month-picker.html',
  styleUrl: './month-picker.scss',
})
export class MonthPicker {
  private store = inject(AppStore);
  readonly mode = input<'month' | 'year'>('month');
  protected readonly months = FULL_MONTHS;
  protected readonly m0 = computed(() => ymMonth0(this.store.ym()));
  protected readonly year = computed(() => ymYear(this.store.ym()));
  protected readonly years = computed(() => yearOptions(this.year()));

  shift(n: number) { this.store.ym.set(addMonths(this.store.ym(), n)); }
  pickMonth(m0: string) { this.store.ym.set(makeYm(this.year(), Number(m0))); }
  pickYear(y: string) { this.store.ym.set(makeYm(Number(y), this.m0())); }
}
