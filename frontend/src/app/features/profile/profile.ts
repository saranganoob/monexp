import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppStore } from '../../core/app-store';

/**
 * Profile: tabs along the top, each its own page under /profile (account, preferences, cards, people, menu),
 * shown in the outlet below – so every tab has a link of its own and the browser's back button works.
 */
@Component({
  selector: 'app-profile',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfilePage {
  private store = inject(AppStore);
  protected readonly tabs = computed(() => [
    { path: 'account', label: 'Account' },
    { path: 'preferences', label: 'Preferences' },
    { path: 'cards', label: `Credit cards · ${this.store.cards().length}` },
    { path: 'people', label: `People · ${this.store.people().length}` },
    { path: 'menu', label: 'Menu', webOnly: true }, // computer only (hidden on phones)
  ]);
}
