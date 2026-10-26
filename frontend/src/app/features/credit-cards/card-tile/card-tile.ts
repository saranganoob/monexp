import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { CardView } from '../../../core/models';
import { fmtInput, parseNum } from '../../../core/utils/format';
import { CardBillEditor } from '../../../shared/components/card-bill-editor/card-bill-editor';
import { EmiEditor } from '../../../shared/components/emi-editor/emi-editor';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Icon } from '../../../shared/ui/icon/icon';
import { CardEmiItem } from '../card-emi/card-emi';
import { CardSpends } from '../card-spends/card-spends';
import { Busy } from '../../../shared/directives/busy';

/** One credit card: this month's bill, my spends, itemised spends, EMIs and totals. */
@Component({
  selector: 'app-card-tile',
  imports: [ReactiveFormsModule, CardBillEditor, EmiEditor, CardSpends, CardEmiItem, InrPipe, YmPipe, Icon, Busy],
  templateUrl: './card-tile.html',
  styleUrl: './card-tile.scss',
})
export class CardTile {
  protected store = inject(AppStore);
  private api = inject(Api);

  readonly card = input.required<CardView>();
  /** "Add EMI to this card" was clicked. */
  readonly addEmi = output<string>();

  protected readonly editingBill = signal(false);
  protected readonly editingEmi = signal<string | null>(null);
  protected readonly spendsControl = inject(NonNullableFormBuilder).control('');
  protected readonly paid = computed(() => this.card().billStatus === 'paid');
  /** EMIs on this card whose first installment is after the month being viewed. */
  protected readonly upcoming = computed(() => {
    const ym = this.store.ym();
    return this.store.emis().filter((e) => e.cardId === this.card().id && e.startYm > ym).map((e) => ({
      e, who: e.forWho === 'friend' ? 'For ' + (this.store.people().find((p) => p.id === e.personId)?.name ?? 'a friend') : 'Mine',
    }));
  });

  constructor() {
    effect(() => this.spendsControl.setValue(fmtInput(this.card().spends), { emitEvent: false }));
  }

  saveSpends() {
    const v = parseNum(this.spendsControl.value);
    if (v !== this.card().spends) this.store.run(this.api.setCardBill(this.store.ym(), this.card().id, { spends: v }));
  }
  togglePaid() {
    const c = this.card();
    const billId = c.billId, status = c.billStatus === 'paid' ? 'unpaid' : 'paid';
    if (billId) this.store.run(() => this.api.updateBill(billId, { status }), { key: this.payKey() });
  }
  /** Same key as the card's row in Need to pay, so both show it saving. */
  protected readonly payKey = () => `bill:${this.card().billId}`;
  removeEmi(id: string) { this.store.run(() => this.api.deleteEmi(id), { key: `remove:${id}` }); }
  editEmi(id: string) { this.editingEmi.set(this.editingEmi() === id ? null : id); }
}
