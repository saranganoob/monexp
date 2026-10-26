import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { AuthService, BUDGET_SHOWN_KEY } from '../../../core/auth/auth.service';
import { fmtInput, parseNum } from '../../../core/utils/format';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Dark blue card: the month's budget, editable in place. Saves on Enter / leaving the field.
 * Hidden by default (it's often the salary); the eye shows it for this tab until sign-out or the tab closes.
 */
@Component({
  selector: 'app-budget-card',
  imports: [ReactiveFormsModule, YmPipe, Icon],
  templateUrl: './budget-card.html',
  styleUrl: './budget-card.scss',
})
export class BudgetCard {
  protected store = inject(AppStore);
  private api = inject(Api);
  readonly ym = input.required<string>();
  readonly budget = input.required<number>();
  protected readonly control = inject(NonNullableFormBuilder).control('');
  private auth = inject(AuthService);
  /** Whose budget was shown in this tab – another person signing in here starts hidden again. */
  private readonly who = computed(() => this.auth.account()?.email || this.auth.account()?.phone || '');
  private readonly shownFor = signal(this.readShown());
  protected readonly shown = computed(() => !!this.who() && this.shownFor() === this.who());

  constructor() {
    effect(() => this.control.setValue(fmtInput(this.budget()), { emitEvent: false }));
  }

  protected toggle() {
    const next = this.shown() ? '' : this.who();
    this.shownFor.set(next);
    try {
      if (next) sessionStorage.setItem(BUDGET_SHOWN_KEY, next);
      else sessionStorage.removeItem(BUDGET_SHOWN_KEY);
    } catch { /* storage blocked – it still works until the page reloads */ }
    if (next) setTimeout(() => document.getElementById('budget')?.focus());
  }

  private readShown(): string {
    try { return sessionStorage.getItem(BUDGET_SHOWN_KEY) ?? ''; } catch { return ''; }
  }

  save() {
    const v = parseNum(this.control.value);
    if (v === this.budget()) return this.control.setValue(fmtInput(v));
    const ym = this.ym();
    this.store.run(() => this.api.setBudget(ym, v), { key: 'budget' });
  }
}
