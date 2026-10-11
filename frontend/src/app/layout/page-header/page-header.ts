import { Component, inject, input } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { Icon } from '../../shared/ui/icon/icon';
import { MonthPicker } from '../month-picker/month-picker';

export interface PageMeta { title: string; kicker: string; picker: 'month' | 'year' | 'none'; monthly: boolean; }

/** Kicker + page title on the left; month picker and "Add expense" on the right. */
@Component({
  selector: 'app-page-header',
  imports: [Icon, MonthPicker],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
})
export class PageHeader {
  protected store = inject(AppStore);
  readonly meta = input.required<PageMeta>();
}
