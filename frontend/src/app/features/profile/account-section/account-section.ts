import { Component } from '@angular/core';
import { AccountTab } from '../account-tab/account-tab';
import { PasswordCard } from '../password-card/password-card';

/** Profile → Account: your details and Change password, side by side on wide screens. */
@Component({
  selector: 'app-account-section',
  imports: [AccountTab, PasswordCard],
  template: `<div class="two-col"><app-account-tab /><app-password-card /></div>`,
  styles: `
    // Both boxes the same height; stacked on narrow screens.
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 24px; align-items: stretch;
      > * { display: block; } }
  `,
})
export class AccountSection {}
