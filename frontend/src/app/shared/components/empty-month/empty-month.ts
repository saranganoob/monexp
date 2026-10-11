import { Component, computed, inject, signal } from '@angular/core';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { MissingMonth } from '../../../core/models';
import { InrPipe } from '../../pipes/inr.pipe';
import { YmPipe } from '../../pipes/ym.pipe';
import { Icon } from '../../ui/icon/icon';

/** Shown instead of a page when the selected month isn't set up yet. */
@Component({
  selector: 'app-empty-month',
  imports: [InrPipe, YmPipe, Icon],
  templateUrl: './empty-month.html',
  styleUrl: './empty-month.scss',
})
export class EmptyMonth {
  private store = inject(AppStore);
  private api = inject(Api);

  protected readonly ym = this.store.ym;
  protected readonly view = computed(() => this.store.view() as MissingMonth);
  protected readonly from = computed(() => this.view()?.rolloverFrom ?? null);
  protected readonly picked = signal(new Set<string>());
  protected readonly busy = signal(false);

  toggle(id: string) {
    const s = new Set(this.picked());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.picked.set(s);
  }

  async create(mode: 'rollover' | 'blank') {
    this.busy.set(true);
    await this.store.run(this.api.createMonth(this.store.ym(), mode, [...this.picked()]));
    this.picked.set(new Set());
    this.busy.set(false);
  }
}
