import { Component, computed, inject, input, signal } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { AccountTab } from './account-tab/account-tab';
import { AppearanceTab } from './appearance-tab/appearance-tab';
import { CardsTab } from './cards-tab/cards-tab';
import { PasswordCard } from './password-card/password-card';
import { PeopleTab } from './people-tab/people-tab';

type Tab = 'account' | 'appearance' | 'cards' | 'persons';

@Component({
  selector: 'app-profile',
  imports: [AccountTab, AppearanceTab, CardsTab, PasswordCard, PeopleTab],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfilePage {
  private store = inject(AppStore);
  /** ?tab=appearance, ?tab=cards or ?tab=persons opens that tab. */
  readonly tab = input<string>();
  protected readonly picked = signal<Tab | null>(null);
  protected readonly current = computed<Tab>(() => {
    const t = this.picked() ?? this.tab();
    return t === 'appearance' || t === 'cards' || t === 'persons' ? t : 'account';
  });
  protected readonly tabs = computed(() => [
    { key: 'account' as Tab, label: 'Account' },
    { key: 'appearance' as Tab, label: 'Preferences' },
    { key: 'cards' as Tab, label: `Credit cards · ${this.store.cards().length}` },
    { key: 'persons' as Tab, label: `People · ${this.store.people().length}` },
  ]);
}
