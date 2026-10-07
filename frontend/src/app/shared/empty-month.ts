import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../core/store';
import { Api } from '../core/api.service';
import { MissingMonth } from '../core/models';
import { inr, ymLabel, ymShort } from '../core/format';

/** Shown instead of a page when the selected month isn't set up yet. */
@Component({
  selector: 'app-empty-month',
  template: `
    <section class="card wrap">
      <div class="icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v16H4zM4 9h16M9 3v4M15 3v4"></path></svg>
      </div>
      <h2 style="margin: 0; font-size: 22px; font-weight: 800">Nothing planned for {{ label() }} yet</h2>
      <p style="margin: 0; max-width: 480px; color: #4B5563; line-height: 1.6">
        @if (from()) {
          Roll over copies your recurring bills and keeps pending money people owe you. Card EMIs and installment counters move forward automatically. Everything starts as unpaid.
        } @else {
          There is no earlier month to copy from. Start blank, or add a bill with “Add expense”.
        }
      </p>
      @if (from() && view()!.carryCandidates.length) {
        <fieldset class="carry">
          <legend style="font-weight: 800; font-size: 15px; padding: 0 6px">Still pending from {{ fromShort() }} — carry any over?</legend>
          <p style="margin: 0 0 6px; font-size: 13px; color: #4B5563; line-height: 1.5">Only tick what’s actually expected in {{ label() }}. Unticked items stay in {{ fromShort() }}. Installments and friends’ card EMIs carry over on their own.</p>
          @for (r of view()!.carryCandidates; track r.id) {
            <label class="row">
              <input type="checkbox" [checked]="picked().has(r.id)" (change)="toggle(r.id)" style="width: 20px; height: 20px; accent-color: #1D4ED8; flex: none">
              <span style="flex: 1; min-width: 0; font-weight: 600">{{ r.name }}</span>
              <span [style]="r.direction === 'in' ? 'font-size: 12px; font-weight: 700; color: #1D4ED8' : 'font-size: 12px; font-weight: 700; color: #9A3412'">{{ r.direction === 'in' ? 'owes you' : 'you owe' }}</span>
              <span class="num" style="font-weight: 800; min-width: 72px; text-align: right">{{ inr(r.amount) }}</span>
            </label>
          }
        </fieldset>
      }
      <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center">
        @if (from()) {
          <button class="btn btn-primary" [disabled]="busy()" (click)="create('rollover')">Roll over from {{ fromShort() }}</button>
        }
        <button class="btn" [disabled]="busy()" (click)="create('blank')">Start a blank month</button>
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
    .icon { width: 56px; height: 56px; border-radius: 16px; background: #E8EEFC; color: #1D4ED8; display: flex; align-items: center; justify-content: center; }
    .carry { width: 100%; max-width: 560px; text-align: left; border: 1px solid #E3E6EB; border-radius: 12px; padding: 14px 16px; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .row { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 4px 0; border-top: 1px solid #EEF0F3; cursor: pointer; }
  `,
})
export class EmptyMonth {
  private store = inject(Store);
  private api = inject(Api);
  protected inr = inr;
  protected view = computed(() => this.store.view() as MissingMonth);
  protected label = computed(() => ymLabel(this.store.ym()));
  protected from = computed(() => this.view()?.rolloverFrom);
  protected fromShort = computed(() => (this.from() ? ymShort(this.from()!) : ''));
  protected picked = signal(new Set<string>());
  protected busy = signal(false);

  toggle(id: string) {
    const s = new Set(this.picked());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.picked.set(s);
  }

  async create(mode: 'rollover' | 'blank') {
    this.busy.set(true);
    await this.store.run(this.api.createMonth(this.store.ym(), mode, [...this.picked()]));
    this.picked.set(new Set());
    this.busy.set(false);
  }
}
