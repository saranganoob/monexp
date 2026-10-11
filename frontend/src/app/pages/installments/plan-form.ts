import { AfterViewInit, Component, computed, inject, input, output, signal } from '@angular/core';
import { Store } from '../../core/store';
import { Api } from '../../core/api.service';
import { Plan } from '../../core/models';
import { FULL_MONTHS, addMonths, fmtInput, inr, makeYm, parseNum, segStyle, val, ymLabel, ymMonth0, ymShort, ymYear } from '../../core/format';

/** Add a new installment plan, or edit one (when `plan` is given). */
@Component({
  selector: 'app-plan-form',
  template: `
    <div style="display: flex; flex-direction: column; gap: 14px" (keydown.escape)="cancel.emit()">
      @if (!plan()) {
        <div role="radiogroup" aria-label="Which way does the money go" style="display: flex; gap: 8px; flex-wrap: wrap">
          <button role="radio" [attr.aria-checked]="direction() === 'out'" (click)="direction.set('out')" [style]="seg(direction() === 'out')">I pay every month</button>
          <button role="radio" [attr.aria-checked]="direction() === 'in'" (click)="direction.set('in')" [style]="seg(direction() === 'in')">Someone pays me back</button>
        </div>
      }
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap: 12px; align-items: end">
        @if (direction() === 'in') {
          <div><label [for]="id + 'p'" class="label lbl">Who pays you</label>
            <select [id]="id + 'p'" class="field" (change)="person.set(val($event)); err.set('')">
              <option value="" [selected]="!person()">Choose a person…</option>
              @for (p of store.people(); track p.id) { <option [value]="p.id" [selected]="person() === p.id">{{ p.name }}</option> }
            </select></div>
        }
        <div><label [for]="id + 'n'" class="label lbl">{{ direction() === 'in' ? 'What for' : 'Name' }}</label>
          <input [id]="id + 'n'" class="field" [value]="name()" (input)="name.set(val($event)); err.set('')" [placeholder]="direction() === 'in' ? 'e.g. gym money' : 'e.g. Dad, Gold chit'"></div>
        @if (direction() === 'out') {
          <div><label [for]="id + 'g'" class="label lbl">Group in Need to pay</label>
            <select [id]="id + 'g'" class="field" (change)="category.set(val($event))">
              @for (c of groups; track c[0]) { <option [value]="c[0]" [selected]="category() === c[0]">{{ c[1] }}</option> }
            </select></div>
        }
        <div><label [for]="id + 'm'" class="label lbl">Per month (₹)</label>
          <input [id]="id + 'm'" class="field num" inputmode="numeric" [value]="monthly()" (input)="monthly.set(val($event)); err.set('')" placeholder="0"></div>
        <div><label [for]="id + 't'" class="label lbl">Total months</label>
          <input [id]="id + 't'" class="field num" inputmode="numeric" [value]="total()" (input)="total.set(val($event)); err.set('')" placeholder="e.g. 12"></div>
        @if (plan()) {
          <div><label [for]="id + 'sm'" class="label lbl">1st month</label>
            <select [id]="id + 'sm'" class="field" (change)="startM.set(+val($event))">
              @for (mn of months; track $index) { <option [value]="$index" [selected]="$index === startM()">{{ mn }}</option> }
            </select></div>
          <div><label [for]="id + 'sy'" class="label lbl">Year</label>
            <select [id]="id + 'sy'" class="field" (change)="startY.set(+val($event))">
              @for (y of years(); track y) { <option [value]="y" [selected]="y === startY()">{{ y }}</option> }
            </select></div>
        } @else {
          <div><label [for]="id + 'a'" class="label lbl">Already paid before {{ monthShort() }}</label>
            <input [id]="id + 'a'" class="field num" inputmode="numeric" [value]="alreadyPaid()" (input)="alreadyPaid.set(val($event)); err.set('')" placeholder="0"></div>
        }
        <div><label [for]="id + 'k'" class="label lbl">Label (optional)</label>
          <input [id]="id + 'k'" class="field" [value]="kind()" (input)="kind.set(val($event))" placeholder="e.g. Monthly support"></div>
      </div>
      @if (summary()) { <div class="num" style="font-size: 13px; color: #374151">{{ summary() }}</div> }
      <div style="font-size: 13px; color: #4B5563; line-height: 1.5">
        {{ direction() === 'in' ? 'It shows under People → They owe me' : 'It shows as a bill in Need to pay' }} from {{ monthLabel() }} onwards. Months before {{ monthLabel() }} aren't changed.
      </div>
      @if (err()) { <div role="alert" class="err">{{ err() }}</div> }
      <div style="display: flex; gap: 8px">
        <button class="btn btn-primary" (click)="save()">{{ plan() ? 'Save plan' : 'Add plan' }}</button>
        @if (plan()) { <button class="btn" (click)="cancel.emit()">Cancel</button> }
      </div>
    </div>
  `,
  styles: `.lbl { display: block; margin-bottom: 6px; }`,
})
export class PlanForm implements AfterViewInit {
  protected store = inject(Store);
  private api = inject(Api);
  readonly plan = input<Plan | null>(null);
  readonly saved = output<void>();
  readonly cancel = output<void>();
  protected val = val;
  protected seg = segStyle;
  protected readonly months = FULL_MONTHS;
  protected readonly groups = [['fam', 'Family & personal'], ['inv', 'Investments & savings'], ['house', 'Housing'], ['sub', 'Subscriptions']];
  protected id = 'pf-' + Math.random().toString(36).slice(2);

  protected direction = signal<'out' | 'in'>('out');
  protected person = signal('');
  protected name = signal('');
  protected category = signal('fam');
  protected monthly = signal('');
  protected total = signal('');
  protected alreadyPaid = signal('0');
  protected startM = signal(0);
  protected startY = signal(new Date().getFullYear());
  protected kind = signal('');
  protected err = signal('');

  protected monthShort = computed(() => ymShort(this.store.ym()));
  protected monthLabel = computed(() => ymLabel(this.store.ym()));
  protected years = computed(() => { const n = new Date().getFullYear(); return [...new Set([n - 4, n - 3, n - 2, n - 1, n, n + 1, this.startY()])].sort(); });
  protected startYm = computed(() => (this.plan() ? makeYm(this.startY(), this.startM()) : addMonths(this.store.ym(), -parseNum(this.alreadyPaid()))));
  protected summary = computed(() => {
    const t = parseNum(this.total()), m = parseNum(this.monthly());
    if (!t) return '';
    return `${ymLabel(this.startYm())} → ${ymLabel(addMonths(this.startYm(), t - 1))}` + (m ? ` · ${inr(m)} × ${t} = ${inr(m * t)}` : '');
  });

  ngAfterViewInit() {
    const p = this.plan();
    if (!p) return;
    this.direction.set(p.direction);
    this.person.set(p.personId ?? '');
    this.name.set(p.name);
    this.category.set(p.category);
    this.monthly.set(fmtInput(p.monthly));
    this.total.set(String(p.totalInstallments));
    this.startM.set(ymMonth0(p.startYm));
    this.startY.set(ymYear(p.startYm));
    this.kind.set(p.kind);
  }

  async save() {
    const name = this.name().trim(), monthly = parseNum(this.monthly()), total = parseNum(this.total());
    if (this.direction() === 'in' && !this.person()) return this.err.set('Choose who is paying you back.');
    if (!name) return this.err.set(this.direction() === 'in' ? 'Add what it’s for.' : 'Add a name.');
    if (!monthly) return this.err.set('Add the amount per month.');
    if (!total) return this.err.set('Add the total number of months.');
    if (!this.plan() && parseNum(this.alreadyPaid()) >= total) return this.err.set('Already-paid months must be fewer than the total.');

    const body: Record<string, unknown> = {
      name, monthly, totalInstallments: total, kind: this.kind().trim(), atYm: this.store.ym(),
      ...(this.direction() === 'in' ? { personId: this.person() } : { category: this.category() }),
    };
    const p = this.plan();
    const request = p
      ? this.api.updatePlan(p.id, { ...body, startYm: this.startYm() })
      : this.api.addPlan({ ...body, direction: this.direction(), alreadyPaid: parseNum(this.alreadyPaid()) });
    const error = await this.store.run(request, { quiet: true });
    if (error) return this.err.set(error);
    if (!p) { this.name.set(''); this.monthly.set(''); this.total.set(''); this.alreadyPaid.set('0'); this.kind.set(''); this.person.set(''); }
    this.err.set('');
    this.saved.emit();
  }
}
