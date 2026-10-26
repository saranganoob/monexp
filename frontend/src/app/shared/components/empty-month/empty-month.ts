import { Component, computed, inject, signal } from '@angular/core';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { MissingMonth } from '../../../core/models';
import { InrPipe } from '../../pipes/inr.pipe';
import { YmPipe } from '../../pipes/ym.pipe';
import { Icon } from '../../ui/icon/icon';
import { Busy } from '../../directives/busy';

/** Shown instead of a page when the selected month isn't set up yet. */
@Component({
  selector: 'app-empty-month',
  imports: [InrPipe, YmPipe, Icon, Busy],
  templateUrl: './empty-month.html',
  styleUrl: './empty-month.scss',
})
export class EmptyMonth {
  protected store = inject(AppStore);
  private api = inject(Api);

  protected readonly ym = this.store.ym;
  protected readonly view = computed(() => this.store.view() as MissingMonth);
  protected readonly from = computed(() => this.view()?.rolloverFrom ?? null);
  protected readonly picked = signal(new Set<string>());
  /** Which button was pressed – it shows "Setting up …" while the month is created. */
  protected readonly mode = signal<'rollover' | 'blank' | null>(null);
  protected readonly busy = computed(() => this.store.loading.isPending('create-month'));

  toggle(id: string) {
    const s = new Set(this.picked());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.picked.set(s);
  }

  async create(mode: 'rollover' | 'blank') {
    const ym = this.store.ym(), carry = [...this.picked()];
    this.mode.set(mode);
    const err = await this.store.run(() => this.api.createMonth(ym, mode, carry), { key: 'create-month' });
    if (!err) this.picked.set(new Set());
  }
}
