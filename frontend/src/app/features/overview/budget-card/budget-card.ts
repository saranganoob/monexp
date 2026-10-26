import { Component, effect, inject, input } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { fmtInput, parseNum } from '../../../core/utils/format';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Icon } from '../../../shared/ui/icon/icon';

/** Dark blue card: the month's budget, editable in place. Saves on Enter / leaving the field. */
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

  constructor() {
    effect(() => this.control.setValue(fmtInput(this.budget()), { emitEvent: false }));
  }

  save() {
    const v = parseNum(this.control.value);
    if (v === this.budget()) return this.control.setValue(fmtInput(v));
    const ym = this.ym();
    this.store.run(() => this.api.setBudget(ym, v), { key: 'budget' });
  }
}
