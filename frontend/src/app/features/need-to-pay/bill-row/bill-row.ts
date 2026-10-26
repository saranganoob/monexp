import { Component, computed, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Bill, CardView } from '../../../core/models';
import { dueInfo } from '../../../core/utils/format';
import { BillEditor } from '../../../shared/components/bill-editor/bill-editor';
import { CardBillEditor } from '../../../shared/components/card-bill-editor/card-bill-editor';
import { SwipeAction } from '../../../shared/directives/swipe-action';
import { Busy } from '../../../shared/directives/busy';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { Icon } from '../../../shared/ui/icon/icon';

/** One bill: tick (or swipe right on phones) to pay, status, amount, and Skip / Edit / Remove. Card bills show their split. */
@Component({
  selector: 'app-bill-row',
  imports: [RouterLink, BillEditor, CardBillEditor, InrPipe, Icon, SwipeAction, Busy],
  templateUrl: './bill-row.html',
  styleUrl: './bill-row.scss',
})
export class BillRow {
  private store = inject(AppStore);
  private api = inject(Api);

  readonly bill = input.required<Bill>();
  readonly card = input<CardView | null>(null);
  readonly ym = input.required<string>();
  /** Id of the row being edited on the page (two-way). */
  readonly editing = model<string | null>(null);
  protected readonly showSplit = signal(false);

  protected readonly due = computed(() => dueInfo(this.bill(), this.ym()));
  protected readonly status = computed(() => (this.bill().status === 'unpaid' && this.due().tone === 'overdue' ? 'overdue' : this.bill().status));
  protected readonly statusLabel = computed(() => ({ paid: 'Paid', unpaid: 'Unpaid', overdue: 'Overdue', skipped: 'Skipped' })[this.status()]);
  protected readonly isEditing = computed(() => this.editing() === this.bill().id);
  /** Rows made by the app (bank/cash EMIs, money I owe): only paid / unpaid here – managed elsewhere. */
  protected readonly isAuto = computed(() => this.bill().kind !== 'bill');
  /** Action key while marking this row paid / unpaid (spinner in the tick, row locked). */
  protected readonly key = computed(() => `bill:${this.bill().id}`);
  protected readonly saving = computed(() => this.store.loading.isPending(this.key()));
  protected readonly sub = computed(() => {
    const b = this.bill(), c = this.card();
    if (c) {
      const friends = c.emis.filter((e) => e.forWho === 'friend').length;
      const base = c.emis.length ? `${c.emis.length} EMI${c.emis.length > 1 ? 's' : ''}${friends ? ` · ${friends} for friends` : ''} + my spends` : 'My spends only';
      return b.note ? `${base} · ${b.note}` : base;
    }
    if (b.kind !== 'bill') return b.note;
    return b.status === 'skipped' ? b.note || 'Skipped this month' : this.due().label;
  });

  toggle() { this.store.togglePaid(this.bill(), this.ym()); }
  skip() { const b = this.bill(); this.store.run(() => this.api.updateBill(b.id, { status: b.status === 'skipped' ? 'unpaid' : 'skipped' }), { key: this.key() }); }
  remove() { const b = this.bill(); this.store.run(() => this.api.deleteBill(b.id), { key: this.key() }); }
  edit() { this.editing.set(this.bill().id); }
  stopEditing() { this.editing.set(null); }
}
