import { Routes } from '@angular/router';
import { adminGuard, authGuard, loginGuard, webOnlyGuard } from './core/auth/auth.guards';
import { PageMeta } from './layout/page-header/page-header';

/** Route data for pages inside the shell – drives the page header. */
const page = (title: string, kicker: string, picker: PageMeta['picker'], monthly: boolean): { data: PageMeta } =>
  ({ data: { title, kicker, picker, monthly } });

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · MonEXP',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '', pathMatch: 'full', title: 'Overview · MonEXP', ...page('Overview', 'Your month at a glance', 'month', true),
        loadComponent: () => import('./features/overview/overview').then((m) => m.OverviewPage),
      },
      {
        path: 'pay', title: 'Need to pay · MonEXP', ...page('Need to pay', 'Bills, EMIs & transfers', 'month', true),
        loadComponent: () => import('./features/need-to-pay/need-to-pay').then((m) => m.NeedToPayPage),
      },
      {
        path: 'cards', title: 'Credit cards · MonEXP', ...page('Credit cards', 'Bills & EMIs — yours and friends’', 'month', true),
        loadComponent: () => import('./features/credit-cards/credit-cards').then((m) => m.CreditCardsPage),
      },
      {
        path: 'installments', title: 'Installments · MonEXP', ...page('Installments', 'Sorted by closing date', 'month', false),
        loadComponent: () => import('./features/installments/installments').then((m) => m.InstallmentsPage),
      },
      {
        path: 'people', title: 'People · MonEXP', ...page('People', 'Who owes whom', 'month', true),
        loadComponent: () => import('./features/people/people').then((m) => m.PeoplePage),
      },
      {
        path: 'sudden', title: 'Sudden spends · MonEXP', ...page('Sudden spends', 'Unplanned expenses', 'month', true),
        loadComponent: () => import('./features/sudden-spends/sudden-spends').then((m) => m.SuddenSpendsPage),
      },
      {
        path: 'year', title: 'Year view · MonEXP', ...page('Year view', 'Trends across the year', 'year', false),
        loadComponent: () => import('./features/year-view/year-view').then((m) => m.YearViewPage),
      },
      {
        path: 'profile', title: 'Profile · MonEXP', canActivate: [webOnlyGuard], ...page('Profile', 'Account, cards & people', 'none', false),
        loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage),
      },
      {
        path: 'admin', title: 'Admin · MonEXP', canActivate: [webOnlyGuard, adminGuard], ...page('Admin', 'Logins for you and your friends', 'none', false),
        loadComponent: () => import('./features/admin/admin').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
