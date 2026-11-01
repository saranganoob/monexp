import { Routes } from '@angular/router';
import { adminGuard, authGuard, loginGuard, menuGuard, webOnlyGuard } from './core/auth/auth.guards';
import { PageMeta } from './layout/page-header/page-header';

/** Route data for pages inside the shell – drives the page header. */
const page = (title: string, kicker: string, picker: PageMeta['picker'], monthly: boolean): { data: PageMeta } =>
  ({ data: { title, kicker, picker, monthly } });

const profilePage = page('Profile', 'Account, cards & people', 'none', false);
/** Old ?tab= names → the Profile tab's page. */
const OLD_PROFILE_TABS: Record<string, string> = { account: 'account', appearance: 'preferences', cards: 'cards', persons: 'people', menu: 'menu' };

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
        path: 'pay', canActivate: [menuGuard('pay')], title: 'Need to pay · MonEXP', ...page('Need to pay', 'Bills, EMIs & transfers', 'month', true),
        loadComponent: () => import('./features/need-to-pay/need-to-pay').then((m) => m.NeedToPayPage),
      },
      {
        path: 'cards', canActivate: [menuGuard('cards')], title: 'Credit cards · MonEXP', ...page('Credit cards', 'Bills & EMIs — yours and friends’', 'month', true),
        loadComponent: () => import('./features/credit-cards/credit-cards').then((m) => m.CreditCardsPage),
      },
      {
        path: 'installments', canActivate: [menuGuard('installments')], title: 'Installments · MonEXP', ...page('Installments', 'Sorted by closing date', 'month', false),
        loadComponent: () => import('./features/installments/installments').then((m) => m.InstallmentsPage),
      },
      {
        path: 'people', canActivate: [menuGuard('people')], title: 'People · MonEXP', ...page('People', 'Who owes whom', 'month', true),
        loadComponent: () => import('./features/people/people').then((m) => m.PeoplePage),
      },
      {
        path: 'sudden', canActivate: [menuGuard('sudden')], title: 'Sudden spends · MonEXP', ...page('Sudden spends', 'Unplanned expenses', 'month', true),
        loadComponent: () => import('./features/sudden-spends/sudden-spends').then((m) => m.SuddenSpendsPage),
      },
      {
        path: 'daily', canActivate: [menuGuard('daily')], title: 'Daily spends · MonEXP', ...page('Daily spends', 'Tea, meals & small spends', 'month', false),
        loadComponent: () => import('./features/daily-spends/daily-spends').then((m) => m.DailySpendsPage),
      },
      {
        path: 'year', canActivate: [menuGuard('year')], title: 'Year view · MonEXP', ...page('Year view', 'Trends across the year', 'year', false),
        loadComponent: () => import('./features/year-view/year-view').then((m) => m.YearViewPage),
      },
      {
        // Profile: one page per tab (/profile/account, /preferences, /cards, /people, /menu).
        path: 'profile', canActivate: [webOnlyGuard],
        loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage),
        children: [
          // /profile, and old links like /profile?tab=cards, open the right tab.
          { path: '', pathMatch: 'full', redirectTo: ({ queryParams }) => `/profile/${OLD_PROFILE_TABS[queryParams['tab']] ?? 'account'}` },
          {
            path: 'account', title: 'Account · Profile · MonEXP', ...profilePage,
            loadComponent: () => import('./features/profile/account-section/account-section').then((m) => m.AccountSection),
          },
          {
            path: 'preferences', title: 'Preferences · Profile · MonEXP', ...profilePage,
            loadComponent: () => import('./features/profile/appearance-tab/appearance-tab').then((m) => m.AppearanceTab),
          },
          {
            path: 'cards', title: 'Credit cards · Profile · MonEXP', ...profilePage,
            loadComponent: () => import('./features/profile/cards-tab/cards-tab').then((m) => m.CardsTab),
          },
          {
            path: 'people', title: 'People · Profile · MonEXP', ...profilePage,
            loadComponent: () => import('./features/profile/people-tab/people-tab').then((m) => m.PeopleTab),
          },
          {
            path: 'menu', title: 'Menu · Profile · MonEXP', ...profilePage,
            loadComponent: () => import('./features/profile/menu-tab/menu-tab').then((m) => m.MenuTab),
          },
          { path: '**', redirectTo: 'account' },
        ],
      },
      {
        path: 'admin', title: 'Admin · MonEXP', canActivate: [webOnlyGuard, adminGuard], ...page('Admin', 'Logins for you and your friends', 'none', false),
        loadComponent: () => import('./features/admin/admin').then((m) => m.AdminPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
