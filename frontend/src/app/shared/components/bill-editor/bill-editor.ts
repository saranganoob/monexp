import { AfterViewInit, Component, ElementRef, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Bill } from '../../../core/models';
import { fmtInput, parseNum } from '../../../core/utils/format';
import { firstError, notBlank, rupees, wholeNumber } from '../../../core/forms/validators';

export const BILL_GROUPS = [
  { key: 'fam', label: 'Family & personal' },
  { key: 'sub', label: 'Subscriptions' },
  { key: 'house', label: 'Housing' },
  { key: 'inv', label: 'Investments & savings' },
] as const;

/** Inline form to change a bill's name, amount, group, due day and note. */
@Component({
  selector: 'app-bill-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './bill-editor.html',
  styleUrl: './bill-editor.scss',
})
export class BillEditor implements OnInit, AfterViewInit {
  private store = inject(AppStore);
  private api = inject(Api);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private fb = inject(NonNullableFormBuilder);

  readonly bill = input.required<Bill>();
  readonly done = output<void>();
  protected readonly groups = BILL_GROUPS;
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    amount: ['', rupees(0)],
    category: ['fam'],
    dueDay: ['', wholeNumber(1, 31)],
    note: ['', Validators.maxLength(500)],
  });

  ngOnInit() {
    const b = this.bill();
    this.form.setValue({ name: b.name, amount: fmtInput(b.amount) || '0', category: b.category, dueDay: b.dueDay ? String(b.dueDay) : '', note: b.note });
  }

  ngAfterViewInit() {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('[formControlName="amount"]')?.select());
  }

  async save() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      name: { required: 'Add a name.' },
      amount: { required: 'Enter the amount (₹0 is fine).', rupees: 'Amount must be whole rupees.' },
      dueDay: { range: 'Due day must be between 1 and 31, or empty.' },
    }));
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const err = await this.store.run(this.api.updateBill(this.bill().id, {
      name: v.name.trim(), amount: parseNum(v.amount), category: v.category,
      dueDay: v.dueDay ? Number(v.dueDay) : null, note: v.note.trim(),
    }), { quiet: true });
    if (err) return this.error.set(err);
    this.done.emit();
  }
}
