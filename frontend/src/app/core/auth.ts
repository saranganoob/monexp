import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Api } from './api.service';
import { Account } from './models';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  /** undefined = not checked yet, null = signed out. */
  readonly account = signal<Account | null | undefined>(undefined);

  async check(): Promise<boolean> {
    if (this.account() === undefined) {
      try { this.account.set(await this.api.me()); } catch { this.account.set(null); }
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
    try { await this.api.logout(); } finally { this.account.set(null); }
  }
}

/** Sends you to the sign-in page if you're not signed in. */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(Auth).check()) || router.createUrlTree(['/login']);
};

export const loginGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(Auth).check()) ? router.createUrlTree(['/']) : true;
};

/** If the session expires mid-use, go back to sign-in. */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/auth/')) {
        auth.account.set(null);
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
