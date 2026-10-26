import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../api.service';
import { Account } from '../models';

/** Shown monthly budget (hidden by default): remembered only in this browser tab, and forgotten on sign-out. */
export const BUDGET_SHOWN_KEY = 'monexp-budget-shown';

/** Who is signed in. `undefined` = not checked yet, `null` = signed out. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(Api);
  readonly account = signal<Account | null | undefined>(undefined);

  async check(): Promise<boolean> {
    if (this.account() === undefined) {
      try {
        this.account.set(await this.api.me());
      } catch {
        this.account.set(null);
      }
    }
    return !!this.account();
  }

  async login(identifier: string, password: string, remember: boolean) {
    this.account.set(await this.api.login(identifier, password, remember));
  }

  async loginWithOtp(identifier: string, otp: string, remember: boolean) {
    this.account.set(await this.api.verifyOtp(identifier, otp, remember));
  }

  async logout() {
    try {
      await this.api.logout();
    } finally {
      try { sessionStorage.removeItem(BUDGET_SHOWN_KEY); } catch { /* storage blocked – nothing to forget */ }
      this.account.set(null);
    }
  }
}
