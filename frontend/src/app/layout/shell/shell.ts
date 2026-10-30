import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AppStore } from '../../core/app-store';
import { AuthService, LAST_PAGE_KEY } from '../../core/auth/auth.service';
import { LiveService } from '../../core/live.service';
import { EmptyMonth } from '../../shared/components/empty-month/empty-month';
import { AddExpenseDialog } from '../add-expense-dialog/add-expense-dialog';
import { EmiDialog } from '../emi-dialog/emi-dialog';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { AskAi } from '../ask-ai/ask-ai';
import { ThemeService } from '../../core/theme.service';
import { Calculator } from '../calculator/calculator';
import { PageHeader, PageMeta } from '../page-header/page-header';
import { Sidebar } from '../sidebar/sidebar';
import { TopBar } from '../top-bar/top-bar';
import { UndoToast } from '../undo-toast/undo-toast';

/** Reopening MonEXP within this long goes back to the page you left; later, it starts on Overview. */
const RESTORE_WITHIN_MS = 12 * 60 * 60 * 1000;

interface LastPage { url: string; who: string; at: number; }

/** The signed-in app frame. Each route's `data` is a PageMeta (title, picker, …). */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, TopBar, PageHeader, EmptyMonth, AddExpenseDialog, EmiDialog, AskAi, Calculator, UndoToast, Skeleton],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  providers: [LiveService], // live updates while signed in
})
export class Shell {
  protected store = inject(AppStore);
  protected auth = inject(AuthService);
  protected theme = inject(ThemeService);
  private live = inject(LiveService);
  private router = inject(Router);

  protected readonly meta = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let s = this.router.routerState.snapshot.root;
        while (s.firstChild) s = s.firstChild;
        return s.data as PageMeta;
      }),
    ),
    { requireSync: true },
  );

  /** Month-based pages show "Nothing planned yet" when the month isn't set up. */
  protected readonly showEmpty = computed(() => this.meta().monthly && this.store.view()?.exists === false);

  constructor() {
    // Remember the page you're on (per device). When the app opens on the front page soon after,
    // go back there instead – e.g. straight to Daily spends. A link to a specific page always wins.
    let first = true;
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      if (first) {
        first = false;
        if (url === '/' && this.restoreLastPage()) return;
      }
      this.write({ url, who: this.who(), at: Date.now() });
    });
  }

  private who() { return this.auth.account()?.email || this.auth.account()?.phone || ''; }

  private restoreLastPage(): boolean {
    const last = this.read();
    if (!last || last.who !== this.who() || last.url === '/' || Date.now() - last.at > RESTORE_WITHIN_MS) return false;
    this.router.navigateByUrl(last.url, { replaceUrl: true }); // pages this device can't open fall back to Overview
    return true;
  }

  private read(): LastPage | null {
    try { return JSON.parse(localStorage.getItem(LAST_PAGE_KEY) ?? 'null'); } catch { return null; }
  }

  private write(page: LastPage) {
    try { localStorage.setItem(LAST_PAGE_KEY, JSON.stringify(page)); } catch { /* storage blocked – just start on Overview next time */ }
  }
}
