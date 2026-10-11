import { Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../core/app-store';
import { Api } from '../../core/api.service';
import { parseNum } from '../../core/utils/format';
import { firstError, notBlank, rupees } from '../../core/forms/validators';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { personRow } from '../../shared/utils/person-row';
import { PersonEntryRow } from './person-entry-row/person-entry-row';

type Direction = 'in' | 'out';

@Component({
  selector: 'app-people',
  imports: [ReactiveFormsModule, InrPipe, PersonEntryRow],
  templateUrl: './people.html',
  styleUrl: './people.scss',
})
export class PeoplePage {
  private store = inject(AppStore);
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);

  /** ?tab=out (from the Add expense dialog) opens "I owe them". */
  readonly tab = input<string>();
  private readonly picked = signal<Direction | null>(null);
  protected readonly dir = computed<Direction>(() => this.picked() ?? (this.tab() === 'out' ? 'out' : 'in'));

  protected readonly month = this.store.month;
  protected readonly rows = computed(() => {
    const m = this.month();
    return m ? (this.dir() === 'in' ? m.receivables : m.payables).map(personRow) : [];
  });
  protected readonly editing = signal<string | null>(null);
  protected readonly addError = signal('');

  protected readonly addForm = this.fb.group({
    name: ['', [notBlank, Validators.maxLength(120)]],
    amount: ['', rupees(1)],
  });

  constructor() {
    this.addForm.valueChanges.subscribe(() => this.addError.set(''));
  }

  pick(d: Direction) {
    this.picked.set(d);
    this.editing.set(null);
  }

  async add() {
    this.addForm.markAllAsTouched();
    this.addError.set(firstError(this.addForm, {
      name: { required: 'Add who it is, e.g. “Ravi · movie tickets”.' },
      amount: { required: 'Add an amount above ₹0.', min: 'Add an amount above ₹0.', rupees: 'Amount must be whole rupees.' },
    }));
    if (this.addError()) return;
    const v = this.addForm.getRawValue();
    const err = await this.store.run(this.api.addEntry(this.store.ym(), { direction: this.dir(), name: v.name.trim(), amount: parseNum(v.amount) }), { quiet: true });
    if (err) return this.addError.set(err);
    this.addForm.reset();
  }
}
