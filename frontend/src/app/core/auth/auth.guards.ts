import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Pages that need you to be signed in. */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).check()) || router.createUrlTree(['/login']);
};

/** The Admin page – only for admin accounts (the server checks this too). */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.check();
  return auth.account()?.isAdmin || inject(Router).createUrlTree(['/']);
};

/** The sign-in page – skip it if you're already signed in. */
export const loginGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).check()) ? router.createUrlTree(['/']) : true;
};
