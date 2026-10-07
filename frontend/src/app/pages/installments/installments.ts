import { Component, computed, effect, inject, signal } from '@angular/core';
import { Store } from '../../core/store';
import { Api, errorMessage } from '../../core/api.service';
import { Installment } from '../../core/models';
import { inr, ymLabel } from '../../core/format';

@Component({
  selector: 'app-installments',
  template: `
    <div class="page">
      <p style="margin: 0; color: #4B5563; max-width: 720px; line-height: 1.6">Every installment in one place, sorted by when it closes — card EMIs (yours and friends'), money you send on a schedule, and people paying you back.</p>
      @if (err()) { <div role="alert" class="err">{{ err() }}</div> }
      <section style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px">
        @for (p of cards(); track p.i.type + p.i.id) {
          <article class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 16px">
            <div style="display: flex; gap: 16px; align-items: center">
              <div [style]="p.ring">
                <div class="num" style="width: 56px; height: 56px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px">{{ p.short }}</div>
              </div>
              <div style="min-width: 0">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em" [style.color]="p.kindColor">{{ p.i.kind }}</div>
                <h3 style="margin: 2px 0 0; font-size: 18px; font-weight: 800">{{ p.i.name }}</h3>
                <div style="font-size: 13px; color: #4B5563">{{ p.i.source }}</div>
              </div>
            </div>
            <dl style="margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; font-size: 14px">
              <div><dt style="color: #4B5563; font-size: 12px">Per month</dt><dd class="num" style="margin: 2px 0 0; font-weight: 700">{{ p.i.monthly ? inr(p.i.monthly) : 'Not entered yet' }}</dd></div>
              <div><dt style="color: #4B5563; font-size: 12px">Months left</dt><dd class="num" style="margin: 2px 0 0; font-weight: 700">{{ p.i.monthsLeft === 1 ? 'This is the last' : p.i.monthsLeft + ' incl. this month' }}</dd></div>
              <div><dt style="color: #4B5563; font-size: 12px">Amount left</dt><dd class="num" style="margin: 2px 0 0; font-weight: 700">{{ p.i.monthly ? inr(p.i.amountLeft) : '—' }}</dd></div>
              <div><dt style="color: #4B5563; font-size: 12px">Closes</dt><dd style="margin: 2px 0 0; font-weight: 700">{{ p.end }}</dd></div>
            </dl>
          </article>
        } @empty {
          <div class="card" style="padding: 32px; text-align: center; color: #4B5563; grid-column: 1 / -1">No running EMIs or installment plans.</div>
        }
      </section>
    </div>
  `,
})
export class InstallmentsPage {
  private store = inject(Store);
  private api = inject(Api);
  protected inr = inr;
  protected list = signal<Installment[]>([]);
  protected err = signal('');

  protected cards = computed(() => this.list().map((i) => {
    const n = Math.max(0, i.n), pct = Math.round((n / i.total) * 100);
    const col = i.incoming ? '#2F5BD3' : i.friend ? '#C2410C' : '#102A6B';
    return {
      i, short: `${n}/${i.total}`, end: ymLabel(i.endYm),
      kindColor: i.incoming ? '#1D4ED8' : i.friend ? '#9A3412' : '#374151',
      ring: `width: 72px; height: 72px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: conic-gradient(${col} 0 ${pct}%, #E3E6EB ${pct}% 100%)`,
    };
  }));

  constructor() {
    effect(async () => {
      const ym = this.store.ym();
      this.store.version();
      try { this.list.set(await this.api.installments(ym)); this.err.set(''); } catch (e) { this.err.set(errorMessage(e)); }
    });
  }
}
