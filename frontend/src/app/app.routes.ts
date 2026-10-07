import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/auth';

// data.picker: which selector the page header shows. data.monthly: page needs the month set up.
export const routes: Routes = [
  { path: 'login', canActivate: [loginGuard], title: 'Sign in · MonEXP', loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', title: 'Overview · MonEXP', data: { title: 'Overview', kicker: 'Your month at a glance', picker: 'month', monthly: true }, loadComponent: () => import('./pages/overview/overview').then((m) => m.OverviewPage) },
      { path: 'pay', title: 'Need to pay · MonEXP', data: { title: 'Need to pay', kicker: 'Bills, EMIs & transfers', picker: 'month', monthly: true }, loadComponent: () => import('./pages/need-to-pay/need-to-pay').then((m) => m.NeedToPayPage) },
      { path: 'cards', title: 'Credit cards · MonEXP', data: { title: 'Credit cards', kicker: 'Bills & EMIs — yours and friends’', picker: 'month', monthly: true }, loadComponent: () => import('./pages/credit-cards/credit-cards').then((m) => m.CreditCardsPage) },
      { path: 'installments', title: 'Installments · MonEXP', data: { title: 'Installments', kicker: 'Sorted by closing date', picker: 'month', monthly: false }, loadComponent: () => import('./pages/installments/installments').then((m) => m.InstallmentsPage) },
      { path: 'people', title: 'People · MonEXP', data: { title: 'People', kicker: 'Who owes whom', picker: 'month', monthly: true }, loadComponent: () => import('./pages/people/people').then((m) => m.PeoplePage) },
      { path: 'sudden', title: 'Sudden spends · MonEXP', data: { title: 'Sudden spends', kicker: 'Unplanned expenses', picker: 'month', monthly: true }, loadComponent: () => import('./pages/sudden/sudden').then((m) => m.SuddenPage) },
      { path: 'year', title: 'Year view · MonEXP', data: { title: 'Year view', kicker: 'Trends across the year', picker: 'year', monthly: false }, loadComponent: () => import('./pages/year/year').then((m) => m.YearPage) },
      { path: 'profile', title: 'Profile · MonEXP', data: { title: 'Profile', kicker: 'Account, cards & people', picker: 'none', monthly: false }, loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
