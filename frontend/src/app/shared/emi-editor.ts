import { AfterViewInit, Component, computed, inject, input, output, signal } from '@angular/core';
import { Store } from '../core/store';
import { Api } from '../core/api.service';
import { CardEmi } from '../core/models';
import { FULL_MONTHS, addMonths, fmtInput, inr, makeYm, parseNum, segStyle, val, ymLabel, ymMonth0, ymYear } from '../core/format';

/** Inline form to change everything about a card EMI – also before its first installment. */
@Component({
  selector: 'app-emi-editor',
  template: `
    <div style="background: #F3F6FD; border: 1.5px solid #1D4ED8; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px" (keydown.escape)="done.emit()">
      <div role="radiogroup" aria-label="Who is this EMI for" style="display: flex; gap: 6px; flex-wrap: wrap">
        <button role="radio" [attr.aria-checked]="forWho() === 'me'" (click)="forWho.set('me')" [style]="seg(forWho() === 'me')">Me</button>
        <button role="radio" [attr.aria-checked]="forWho() === 'friend'" (click)="forWho.set('friend')" [style]="seg(forWho() === 'friend')">A friend</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
        <div style="grid-column: 1 / -1"><label [for]="id + 'i'" class="lbl">What was bought</label><input [id]="id + 'i'" class="field" [value]="item()" (input)="item.set(val($event)); err.set('')"></div>
        @if (forWho() === 'friend') {
          <div style="grid-column: 1 / -1"><label [for]="id + 'p'" class="lbl">Friend</label>
            <select [id]="id + 'p'" class="field" (change)="person.set(val($event)); err.set('')">
              <option value="" [selected]="!person()">Choose a person…</option>
              @for (p of store.people(); track p.id) { <option [value]="p.id" [selected]="person() === p.id">{{ p.name }}</option> }
            </select></div>
        }
        <div><label [for]="id + 'm'" class="lbl">EMI per month (₹)</label><input [id]="id + 'm'" class="field num" inputmode="numeric" [value]="monthly()" (input)="monthly.set(val($event)); err.set('')"></div>
        <div><label [for]="id + 't'" class="lbl">Total months</label><input [id]="id + 't'" class="field num" inputmode="numeric" [value]="total()" (input)="total.set(val($event)); err.set('')"></div>
        <div><label [for]="id + 'sm'" class="lbl">1st EMI month</label>
          <select [id]="id + 'sm'" class="field" (change)="startM.set(+val($event))">
            @for (mn of months; track $index) { <option [value]="$index" [selected]="$index === startM()">{{ mn }}</option> }
          </select></div>
        <div><label [for]="id + 'sy'" class="lbl">Year</label>
          <select [id]="id + 'sy'" class="field" (change)="startY.set(+val($event))">
            @for (y of years(); track y) { <option [value]="y" [selected]="y === startY()">{{ y }}</option> }
          </select></div>
      </div>
      <div class="num" style="font-size: 13px; color: #374151">{{ summary() }}</div>
      @if (err()) { <div role="alert" style="font-size: 13px; color: #A3201A; font-weight: 600">{{ err() }}</div> }
      <div style="display: flex; gap: 8px"><button class="btn btn-primary btn-sm" (click)="save()">Save</button><button class="btn btn-sm" (click)="done.emit()">Cancel</button></div>
    </div>
  `,
  styles: `.lbl { display: block; font-size: 12px; color: #4B5563; margin-bottom: 4px; font-weight: 600; } .field { min-height: 40px; }`,
})
export class EmiEditor implements AfterViewInit {
  protected store = inject(Store);
  private api = inject(Api);
  readonly emi = input.required<CardEmi>();
  readonly done = output<void>();
  protected val = val;
  protected readonly months = FULL_MONTHS;
  protected id = 'ee-' + Math.random().toString(36).slice(2);
  protected seg = (on: boolean) => segStyle(on).replace('min-height: 44px', 'min-height: 36px');

  protected forWho = signal<'me' | 'friend'>('me');
  protected person = signal('');
  protected item = signal('');
  protected monthly = signal('');
  protected total = signal('');
  protected startM = signal(0);
  protected startY = signal(new Date().getFullYear());
  protected err = signal('');

  protected years = computed(() => { const n = new Date().getFullYear(); return [...new Set([n - 2, n - 1, n, n + 1, this.startY()])].sort(); });
  protected summary = computed(() => {
    const t = parseNum(this.total()), m = parseNum(this.monthly());
    if (!t) return '';
    const start = makeYm(this.startY(), this.startM());
    return `${ymLabel(start)} → ${ymLabel(addMonths(start, t - 1))}` + (m ? ` · ${inr(m * t)} in total` : '');
  });

  ngAfterViewInit() {
    const e = this.emi();
    this.forWho.set(e.forWho);
    this.person.set(e.personId ?? '');
    this.item.set(e.item);
    this.monthly.set(fmtInput(e.monthly));
    this.total.set(String(e.totalMonths));
    this.startM.set(ymMonth0(e.startYm));
    this.startY.set(ymYear(e.startYm));
  }

  async save() {
    const item = this.item().trim(), total = parseNum(this.total());
    if (!item) return this.err.set('Add what was bought.');
    if (this.forWho() === 'friend' && !this.person()) return this.err.set('Choose who this EMI is for.');
    if (!total) return this.err.set('Add the total number of months.');
    const error = await this.store.run(this.api.updateEmi(this.emi().id, {
      item, forWho: this.forWho(), personId: this.forWho() === 'friend' ? this.person() : null,
      monthly: parseNum(this.monthly()), totalMonths: total, startYm: makeYm(this.startY(), this.startM()),
    }), { quiet: true });
    if (error) return this.err.set(error);
    this.done.emit();
  }
}
