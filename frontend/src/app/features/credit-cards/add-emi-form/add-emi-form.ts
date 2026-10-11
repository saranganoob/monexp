import { Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { parseNum } from '../../../core/utils/format';
import { firstError, notBlank, rupees, wholeNumber } from '../../../core/forms/validators';
import { YmPipe } from '../../../shared/pipes/ym.pipe';

/** "Add an EMI" – for me, or a friend's purchase on my card. */
@Component({
  selector: 'app-add-emi-form',
  imports: [ReactiveFormsModule, RouterLink, YmPipe],
  templateUrl: './add-emi-form.html',
  styleUrl: './add-emi-form.scss',
})
export class AddEmiForm {
  protected store = inject(AppStore);
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Set by "Add EMI to this card": pre-selects that card and jumps here. */
  readonly preset = input<{ cardId: string } | null>(null);
  protected readonly error = signal('');
  protected readonly openCards = computed(() => this.store.cards().filter((c) => !c.closedOn));

  protected readonly form = this.fb.group({
    forWho: ['me' as 'me' | 'friend'],
    cardId: [''],
    personId: [''],
    item: ['', notBlank],
    monthly: ['', rupees(1)],
    totalMonths: ['', [Validators.required, wholeNumber(1, 600)]],
    alreadyPaid: ['0', wholeNumber(0, 600)],
  });
  private readonly forWho = toSignal(this.form.controls.forWho.valueChanges, { initialValue: 'me' as const });
  protected readonly isFriend = computed(() => this.forWho() === 'friend');

  constructor() {
    // Default to the first open card once cards load.
    effect(() => {
      const first = this.openCards()[0]?.id ?? '';
      if (!this.form.controls.cardId.value && first) this.form.controls.cardId.setValue(first);
    });
    effect(() => {
      const p = this.preset();
      if (!p) return;
      this.form.controls.cardId.setValue(p.cardId);
      const item = this.host.nativeElement.querySelector<HTMLInputElement>('#eItem');
      item?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item?.focus({ preventScroll: true });
    });
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  async add() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const total = Number(v.totalMonths), paid = Number(v.alreadyPaid || 0);
    const problem =
      firstError(this.form, { item: { required: 'Add what was bought.' } })
      || (v.forWho === 'friend' && !v.personId ? 'Choose who this EMI is for, or add them with “+ Add a new person”.' : '')
      || firstError(this.form, {
        monthly: { required: 'Add the EMI amount per month.', min: 'Add the EMI amount per month.', rupees: 'EMI amount must be whole rupees.' },
        totalMonths: { required: 'Add the total number of months.', range: 'Total months must be a whole number.' },
        alreadyPaid: { range: 'Already paid must be a whole number.' },
      })
      || (paid >= total ? 'Already-paid installments must be fewer than the total.' : '');
    if (problem) return this.error.set(problem);

    const err = await this.store.run(this.api.addEmi({
      cardId: v.cardId, item: v.item.trim(), forWho: v.forWho, personId: v.forWho === 'friend' ? v.personId : null,
      monthly: parseNum(v.monthly), totalMonths: total, atYm: this.store.ym(), alreadyPaid: paid,
    }), { quiet: true });
    if (err) return this.error.set(err);
    this.form.patchValue({ item: '', personId: '', monthly: '', totalMonths: '', alreadyPaid: '0' });
    this.form.markAsUntouched();
  }
}
