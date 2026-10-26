import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AppStore } from '../../core/app-store';
import { LiveService } from '../../core/live.service';
import { EmptyMonth } from '../../shared/components/empty-month/empty-month';
import { AddExpenseDialog } from '../add-expense-dialog/add-expense-dialog';
import { EmiDialog } from '../emi-dialog/emi-dialog';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { AskAi } from '../ask-ai/ask-ai';
import { PageHeader, PageMeta } from '../page-header/page-header';
import { Sidebar } from '../sidebar/sidebar';
import { TopBar } from '../top-bar/top-bar';
import { UndoToast } from '../undo-toast/undo-toast';

/** The signed-in app frame. Each route's `data` is a PageMeta (title, picker, …). */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, TopBar, PageHeader, EmptyMonth, AddExpenseDialog, EmiDialog, AskAi, UndoToast, Skeleton],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  providers: [LiveService], // live updates while signed in
})
export class Shell {
  protected store = inject(AppStore);
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
}
