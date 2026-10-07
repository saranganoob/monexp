import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Store } from '../core/store';
import { Auth } from '../core/auth';
import { FULL_MONTHS, addMonths, makeYm, todayLabel, val, ymMonth0, ymYear } from '../core/format';
import { EmptyMonth } from '../shared/empty-month';
import { AddExpenseDialog } from './add-expense-dialog';
import { UndoToast } from './undo-toast';

interface PageData { title: string; kicker: string; picker: 'month' | 'year' | 'none'; monthly: boolean; }

const NAV = [
  { path: '/', label: 'Overview', exact: true, d: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { path: '/pay', label: 'Need to pay', badge: true, d: 'M9 5h11M9 12h11M9 19h11M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2' },
  { path: '/cards', label: 'Credit cards', d: 'M3 6h18v12H3zM3 10h18M7 15h3' },
  { path: '/installments', label: 'Installments', d: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4M9 15l2 2 4-4' },
  { path: '/people', label: 'People', d: 'M16 19c0-2.2-1.8-4-4-4H6c-2.2 0-4 1.8-4 4M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19c0-2-1.3-3.6-3-4M16 5.5a3 3 0 0 1 0 5.6' },
  { path: '/sudden', label: 'Sudden spends', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  { path: '/year', label: 'Year view', d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EmptyMonth, AddExpenseDialog, UndoToast],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected store = inject(Store);
  protected auth = inject(Auth);
  private router = inject(Router);

  protected readonly nav = NAV;
  protected readonly months = FULL_MONTHS;
  protected readonly today = todayLabel();

  protected readonly page = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let s = this.router.routerState.snapshot.root;
        while (s.firstChild) s = s.firstChild;
        return s.data as PageData;
      }),
    ),
    { requireSync: true },
  );

  protected readonly m0 = computed(() => ymMonth0(this.store.ym()));
  protected readonly year = computed(() => ymYear(this.store.ym()));
  protected readonly years = computed(() => {
    const now = new Date().getFullYear();
    const set = new Set([now - 1, now, now + 1, this.year()]);
    return [...set].sort();
  });
  protected readonly showEmpty = computed(() => this.page().monthly && this.store.view()?.exists === false);
  protected readonly initial = computed(() => (this.auth.account()?.email || 'M').charAt(0).toUpperCase());
  protected readonly onProfile = computed(() => this.page().title === 'Profile');

  shift(n: number) { this.store.ym.set(addMonths(this.store.ym(), n)); }
  pickMonth(e: Event) { this.store.ym.set(makeYm(this.year(), Number(val(e)))); }
  pickYear(e: Event) { this.store.ym.set(makeYm(Number(val(e)), this.m0())); }

  async signOut() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
