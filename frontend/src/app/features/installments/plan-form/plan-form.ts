import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Plan } from '../../../core/models';
import { FULL_MONTHS, addMonths, fmtInput, inr, makeYm, parseNum, yearOptions, ymLabel, ymMonth0, ymYear } from '../../../core/utils/format';
import { firstError, notBlank, rupees, wholeNumber } from '../../../core/forms/validators';
import { YmPipe } from '../../../shared/pipes/ym.pipe';

const PLAN_GROUPS = [
  { key: 'fam', label: 'Family & personal' },
  { key: 'inv', label: 'Investments & savings' },
  { key: 'house', label: 'Housing' },
  { key: 'sub', label: 'Subscriptions' },
];

/** Add a new installment plan, or edit one when `plan` is given. */
@Component({
  selector: 'app-plan-form',
  imports: [ReactiveFormsModule, YmPipe],
  templateUrl: './plan-form.html',
  styleUrl: './plan-form.scss',
})
export class PlanForm implements OnInit {
  protected store = inject(AppStore);
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);

  readonly plan = input<Plan | null>(null);
  readonly saved = output<void>();
  readonly cancel = output<void>();

  protected readonly months = FULL_MONTHS;
  protected readonly groups = PLAN_GROUPS;
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    direction: ['out' as 'out' | 'in'],
    personId: [''],
    name: ['', [notBlank, Validators.maxLength(80)]],
    category: ['fam'],
    monthly: ['', rupees(1)],
    totalInstallments: ['', [Validators.required, wholeNumber(1, 600)]],
    alreadyPaid: ['0', wholeNumber(0, 600)],
    startMonth: [0],
    startYear: [new Date().getFullYear()],
    kind: ['', Validators.maxLength(40)],
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly isIn = computed(() => this.v().direction === 'in');
  protected readonly years = computed(() => yearOptions(Number(this.v().startYear), 4, 1));
  protected readonly startYm = computed(() => {
    const v = this.v();
    return this.plan() ? makeYm(Number(v.startYear), Number(v.startMonth)) : addMonths(this.store.ym(), -parseNum(v.alreadyPaid));
  });
  protected readonly summary = computed(() => {
    const t = Number(this.v().totalInstallments), m = parseNum(this.v().monthly);
    if (!Number.isInteger(t) || t < 1) return '';
    const start = this.startYm();
    return `${ymLabel(start)} → ${ymLabel(addMonths(start, t - 1))}` + (m ? ` · ${inr(m)} × ${t} = ${inr(m * t)}` : '');
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  ngOnInit() {
    const p = this.plan();
    if (!p) return;
    this.form.patchValue({
      direction: p.direction, personId: p.personId ?? '', name: p.name, category: p.category, monthly: fmtInput(p.monthly),
      totalInstallments: String(p.totalInstallments), startMonth: ymMonth0(p.startYm), startYear: ymYear(p.startYm), kind: p.kind,
    });
  }

  async save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const total = Number(v.totalInstallments);
    const problem =
      (v.direction === 'in' && !v.personId ? 'Choose who is paying you back.' : '')
      || firstError(this.form, {
        name: { required: v.direction === 'in' ? 'Add what it’s for.' : 'Add a name.' },
        monthly: { required: 'Add the amount per month.', min: 'Add the amount per month.', rupees: 'Amount must be whole rupees.' },
        totalInstallments: { required: 'Add the total number of months.', range: 'Total months must be a whole number.' },
        alreadyPaid: { range: 'Already paid must be a whole number.' },
      })
      || (!this.plan() && parseNum(v.alreadyPaid) >= total ? 'Already-paid months must be fewer than the total.' : '');
    if (problem) return this.error.set(problem);

    const body: Record<string, unknown> = {
      name: v.name.trim(), monthly: parseNum(v.monthly), totalInstallments: total, kind: v.kind.trim(), atYm: this.store.ym(),
      ...(v.direction === 'in' ? { personId: v.personId } : { category: v.category }),
    };
    const p = this.plan();
    const err = await this.store.run(
      p ? this.api.updatePlan(p.id, { ...body, startYm: this.startYm() })
        : this.api.addPlan({ ...body, direction: v.direction, alreadyPaid: parseNum(v.alreadyPaid) }),
      { quiet: true },
    );
    if (err) return this.error.set(err);
    if (!p) {
      this.form.reset({ direction: v.direction, category: v.category, alreadyPaid: '0', startYear: new Date().getFullYear() });
    }
    this.saved.emit();
  }
}
