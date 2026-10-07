import { AfterViewInit, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { Store } from '../core/store';
import { Api } from '../core/api.service';
import { CardView } from '../core/models';
import { fmtInput, inr, parseNum, val, ymLabel } from '../core/format';

/** Inline "Edit bill" box: enter the statement total, we keep the EMIs and work out my spends. */
@Component({
  selector: 'app-card-bill-editor',
  template: `
    <div style="background: #F3F6FD; border: 1.5px solid #1D4ED8; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">
      <label [for]="inputId" style="font-size: 13px; font-weight: 700; color: #1E3A8A">{{ card().name }} bill for {{ label }}</label>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
        <div style="display: flex; align-items: center; gap: 6px; flex: 1 1 160px; background: #fff; border: 1px solid #CDD3DB; border-radius: 10px; padding: 0 12px">
          <span style="font-weight: 800">₹</span>
          <input [id]="inputId" class="num" inputmode="numeric" [value]="text()" (input)="text.set(val($event)); err.set('')" (keydown.enter)="save()" (keydown.escape)="done.emit()"
            style="font: inherit; font-size: 18px; font-weight: 800; border: none; outline: none; min-height: 44px; width: 100%; min-width: 0; background: transparent; color: #111827">
        </div>
        <button class="btn btn-primary" (click)="save()">Save</button>
        <button class="btn" (click)="done.emit()">Cancel</button>
      </div>
      <div class="num" style="font-size: 13px; color: #374151">{{ preview() }}</div>
      @if (err()) { <div role="alert" style="font-size: 13px; color: #A3201A; font-weight: 600">{{ err() }}</div> }
    </div>
  `,
})
export class CardBillEditor implements AfterViewInit {
  private store = inject(Store);
  private api = inject(Api);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly card = input.required<CardView>();
  readonly done = output<void>();
  protected val = val;
  protected inputId = 'bill-' + Math.random().toString(36).slice(2);
  protected label = ymLabel(this.store.ym());
  protected text = signal('');
  protected err = signal('');

  ngAfterViewInit() {
    this.text.set(fmtInput(this.card().total));
    setTimeout(() => { const i = this.el.nativeElement.querySelector('input'); i?.focus(); i?.select(); });
  }

  preview() {
    const c = this.card(), emi = c.myEmis + c.friendEmis, v = parseNum(this.text());
    if (!emi) return `All of it counts as your own spends: ${inr(v)}`;
    return `${inr(emi)} EMIs + ${inr(Math.max(v - emi, 0))} your spends`;
  }

  async save() {
    if (!this.text().trim()) return this.err.set('Enter the bill amount (₹0 if nothing is due).');
    const error = await this.store.run(this.api.setCardBill(this.store.ym(), this.card().id, { total: parseNum(this.text()) }), { quiet: true });
    if (error) return this.err.set(error);
    this.done.emit();
  }
}
