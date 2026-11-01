import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { isInstalledApp } from '../utils/platform';

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

/** Pages kept to the website (Profile, Admin) – the installed phone app goes to Overview instead. */
export const webOnlyGuard: CanActivateFn = () => !isInstalledApp() || inject(Router).createUrlTree(['/']);

/** A menu section the person switched off (Profile → Menu) – an old link or bookmark goes to Overview instead. */
export const menuGuard = (key: string): CanActivateFn => () =>
  !inject(AuthService).account()?.prefs?.navHidden?.includes(key) || inject(Router).createUrlTree(['/']);

/** The sign-in page – skip it if you're already signed in. */
export const loginGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).check()) ? router.createUrlTree(['/']) : true;
};
