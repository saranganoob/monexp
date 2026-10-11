import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { CardEmi } from '../../../core/models';
import { FULL_MONTHS, addMonths, fmtInput, inr, makeYm, parseNum, yearOptions, ymLabel, ymMonth0, ymYear } from '../../../core/utils/format';
import { firstError, notBlank, rupees, wholeNumber } from '../../../core/forms/validators';

/** Inline form to change everything about a card EMI – also before its first installment. */
@Component({
  selector: 'app-emi-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './emi-editor.html',
  styleUrl: './emi-editor.scss',
})
export class EmiEditor implements OnInit {
  protected store = inject(AppStore);
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);

  readonly emi = input.required<CardEmi>();
  readonly done = output<void>();
  protected readonly months = FULL_MONTHS;
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    forWho: ['me' as 'me' | 'friend'],
    personId: [''],
    item: ['', notBlank],
    monthly: ['', rupees(0)],
    totalMonths: ['', [Validators.required, wholeNumber(1, 600)]],
    startMonth: [0],
    startYear: [new Date().getFullYear()],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly isFriend = computed(() => this.value().forWho === 'friend');
  protected readonly years = computed(() => yearOptions(Number(this.value().startYear), 2, 1));
  protected readonly summary = computed(() => {
    const v = this.value(), t = Number(v.totalMonths), m = parseNum(v.monthly);
    if (!Number.isInteger(t) || t < 1) return '';
    const start = makeYm(Number(v.startYear), Number(v.startMonth));
    return `${ymLabel(start)} → ${ymLabel(addMonths(start, t - 1))}` + (m ? ` · ${inr(m * t)} in total` : '');
  });

  ngOnInit() {
    const e = this.emi();
    this.form.setValue({
      forWho: e.forWho, personId: e.personId ?? '', item: e.item, monthly: fmtInput(e.monthly),
      totalMonths: String(e.totalMonths), startMonth: ymMonth0(e.startYm), startYear: ymYear(e.startYm),
    });
  }

  async save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    this.error.set(
      firstError(this.form, {
        item: { required: 'Add what was bought.' },
        monthly: { rupees: 'EMI amount must be whole rupees.' },
        totalMonths: { required: 'Add the total number of months.', range: 'Total months must be a whole number.' },
      }) || (v.forWho === 'friend' && !v.personId ? 'Choose who this EMI is for.' : ''),
    );
    if (this.error()) return;
    const err = await this.store.run(this.api.updateEmi(this.emi().id, {
      item: v.item.trim(), forWho: v.forWho, personId: v.forWho === 'friend' ? v.personId : null,
      monthly: parseNum(v.monthly), totalMonths: Number(v.totalMonths), startYm: makeYm(Number(v.startYear), Number(v.startMonth)),
    }), { quiet: true });
    if (err) return this.error.set(err);
    this.done.emit();
  }
}
