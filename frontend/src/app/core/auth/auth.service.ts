import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../api.service';
import { Account } from '../models';

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
      this.account.set(null);
    }
  }
}
