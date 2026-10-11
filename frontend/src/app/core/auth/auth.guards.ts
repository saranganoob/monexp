import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Pages that need you to be signed in. */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).check()) || router.createUrlTree(['/login']);
};

/** The sign-in page – skip it if you're already signed in. */
export const loginGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).check()) ? router.createUrlTree(['/']) : true;
};
