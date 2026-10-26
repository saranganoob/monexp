import { Component, computed, inject } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { Api } from '../../core/api.service';
import { Sudden } from '../../core/models';
import { MONTHS } from '../../core/utils/format';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { YmPipe } from '../../shared/pipes/ym.pipe';
import { SuddenForm } from './sudden-form/sudden-form';
import { Busy } from '../../shared/directives/busy';

@Component({
  selector: 'app-sudden-spends',
  imports: [InrPipe, YmPipe, SuddenForm, Busy],
  templateUrl: './sudden-spends.html',
  styleUrl: './sudden-spends.scss',
})
export class SuddenSpendsPage {
  protected store = inject(AppStore);
  private api = inject(Api);
  protected readonly month = this.store.month;
  protected readonly rows = computed(() => (this.month()?.suddenSpends ?? []).map((s) => ({
    s,
    when: s.dateUnknown ? `${MONTHS[Number(s.date.slice(5, 7)) - 1]} (date not in sheet)` : null,
    mode: s.mode + (s.cardId ? ' · already in a card bill, not deducted again' : ''),
  })));

  remove(s: Sudden) { this.store.run(() => this.api.deleteSudden(s.id), { key: `remove:${s.id}` }); }
}
