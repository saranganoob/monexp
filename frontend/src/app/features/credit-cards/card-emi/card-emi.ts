import { Component, computed, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { EmiView } from '../../../core/models';
import { fmtInput, parseNum } from '../../../core/utils/format';
import { EmiEditor } from '../../../shared/components/emi-editor/emi-editor';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { ProgressBar } from '../../../shared/ui/progress-bar/progress-bar';
import { Busy } from '../../../shared/directives/busy';

/** One running EMI on a card: progress, monthly amount, what's left, and (for friends) "Mark received". */
@Component({
  selector: 'app-card-emi',
  imports: [ReactiveFormsModule, EmiEditor, InrPipe, YmPipe, ProgressBar, Busy],
  templateUrl: './card-emi.html',
  styleUrl: './card-emi.scss',
})
export class CardEmiItem {
  protected store = inject(AppStore);
  private api = inject(Api);

  readonly emi = input.required<EmiView>();
  readonly editing = input(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly closed = output<void>();

  protected readonly monthly = inject(NonNullableFormBuilder).control('');
  protected readonly isFriend = computed(() => this.emi().forWho === 'friend');
  protected readonly raw = computed(() => this.store.emis().find((e) => e.id === this.emi().id) ?? null);
  protected readonly amountLeft = computed(() => { const e = this.emi(); return e.total == null ? 0 : e.monthly * (e.total - e.n + 1); });

  constructor() {
    effect(() => this.monthly.setValue(fmtInput(this.emi().monthly), { emitEvent: false }));
  }

  saveMonthly() {
    const v = parseNum(this.monthly.value);
    if (v !== this.emi().monthly) this.store.run(this.api.updateEmi(this.emi().id, { monthly: v }));
  }

  protected readonly recvKey = () => `entry:emi:${this.emi().id}`;
  toggleReceived() {
    const e = this.emi();
    const ym = this.store.ym(), received = e.received === 'done' ? 'pending' : 'done';
    this.store.run(() => this.api.setEmiMonth(ym, e.id, { received }), { key: this.recvKey() });
  }
}
