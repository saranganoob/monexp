import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../../core/app-store';
import { Api } from '../../../core/api.service';
import { Card } from '../../../core/models';
import { ymIndex } from '../../../core/utils/format';
import { firstError, notBlank } from '../../../core/forms/validators';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Icon } from '../../../shared/ui/icon/icon';

export const NETWORKS = ['Visa', 'RuPay', 'Maestro', 'Mastercard'] as const;

/** Your credit cards: name, network, last 4 digits; close, reopen or delete. */
@Component({
  selector: 'app-cards-tab',
  imports: [ReactiveFormsModule, InrPipe, YmPipe, Icon],
  templateUrl: './cards-tab.html',
  styleUrl: './cards-tab.scss',
})
export class CardsTab {
  protected store = inject(AppStore);
  private api = inject(Api);

  protected readonly networks = NETWORKS;
  protected readonly editingId = signal<string | null>(null);
  protected readonly message = signal<{ id: string; text: string } | null>(null);
  protected readonly error = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [notBlank, Validators.maxLength(60)]],
    last4: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    network: ['', Validators.required],
  });

  protected readonly tiles = computed(() => {
    const ym = this.store.ym(), I = ymIndex(ym);
    return this.store.cards().map((c) => ({
      c,
      networkClass: 'face--' + (c.network || 'none').toLowerCase(),
      bill: this.store.month()?.cards.find((x) => x.id === c.id)?.total ?? 0,
      running: this.store.emis().filter((e) => e.cardId === c.id && ymIndex(e.startYm) <= I && ymIndex(e.startYm) + e.totalMonths - 1 >= I).length,
    }));
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(''));
  }

  edit(c: Card) {
    this.editingId.set(c.id);
    this.message.set(null);
    this.form.setValue({ name: c.name, last4: c.last4, network: c.network });
    setTimeout(() => document.getElementById('cfName')?.focus());
  }

  cancel() {
    this.editingId.set(null);
    this.form.reset();
  }

  toggleClosed(c: Card) {
    this.message.set(null);
    this.store.run(this.api.updateCard(c.id, { closed: !c.closedOn }));
  }

  async remove(c: Card) {
    const err = await this.store.run(this.api.deleteCard(c.id), { quiet: true });
    this.message.set(err ? { id: c.id, text: err } : null);
  }

  async save() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      name: { required: 'Add the card’s name.' },
      last4: { required: 'Enter exactly the last 4 digits.', pattern: 'Enter exactly the last 4 digits.' },
      network: { required: 'Choose the card network.' },
    }));
    if (this.error()) return;
    const v = this.form.getRawValue(), id = this.editingId();
    const body = { name: v.name.trim(), last4: v.last4, network: v.network };
    const err = await this.store.run(id ? this.api.updateCard(id, body) : this.api.addCard({ ...body, addToYm: this.store.ym() }), { quiet: true });
    if (err) return this.error.set(err);
    this.cancel();
  }
}
