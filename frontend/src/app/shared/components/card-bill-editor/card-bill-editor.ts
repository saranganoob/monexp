import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { CardView } from '../../../core/models';
import { fmtInput, inr, parseNum } from '../../../core/utils/format';
import { firstError, rupees } from '../../../core/forms/validators';
import { YmPipe } from '../../pipes/ym.pipe';
import { Busy } from '../../directives/busy';

/** "Edit bill": type the statement total; the EMIs are kept and the rest counts as my spends. */
@Component({
  selector: 'app-card-bill-editor',
  imports: [ReactiveFormsModule, YmPipe, Busy],
  templateUrl: './card-bill-editor.html',
  styleUrl: './card-bill-editor.scss',
})
export class CardBillEditor implements OnInit, AfterViewInit {
  protected store = inject(AppStore);
  private api = inject(Api);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private fb = inject(NonNullableFormBuilder);

  readonly card = input.required<CardView>();
  readonly done = output<void>();
  protected readonly ym = this.store.ym;
  protected readonly error = signal('');
  protected readonly form = this.fb.group({ total: ['', rupees(0)] });
  private readonly total = toSignal(this.form.controls.total.valueChanges, { initialValue: '' });

  protected readonly preview = computed(() => {
    const c = this.card(), emi = c.myEmis + c.friendEmis, v = parseNum(this.total());
    return emi ? `${inr(emi)} EMIs + ${inr(Math.max(v - emi, 0))} your spends` : `All of it counts as your own spends: ${inr(v)}`;
  });

  ngOnInit() { this.form.setValue({ total: fmtInput(this.card().total) }); }

  ngAfterViewInit() {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('input')?.select());
  }

  async save() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, { total: { required: 'Enter the bill amount (₹0 if nothing is due).', rupees: 'Amount must be whole rupees.' } }));
    if (this.form.invalid) return;
    const ym = this.store.ym(), cardId = this.card().id, total = parseNum(this.form.getRawValue().total);
    const err = await this.store.run(() => this.api.setCardBill(ym, cardId, { total }), { quiet: true, key: `card-bill:${cardId}` });
    if (err) return this.error.set(err);
    this.done.emit();
  }
}
