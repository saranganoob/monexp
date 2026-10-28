import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme.service';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { isInstalledApp } from '../../core/utils/platform';

interface NavItem { path: string; label: string; icon: IconName; exact?: boolean; badge?: boolean; admin?: boolean; }

/** How long the pointer can leave the hover sidebar before it closes (so it doesn't flicker). */
const CLOSE_DELAY_MS = 120;

/** Left navigation (a scrolling top bar on phones). Two web styles, saved per user: classic, or pin & hover. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  host: { '[class.has-rail]': 'rail()', '[class.is-narrow]': 'narrow()' },
})
export class Sidebar implements OnDestroy {
  protected store = inject(AppStore);
  protected auth = inject(AuthService);
  /** Icon-only rail on wide screens (the toggle is hidden on phones). */
  protected readonly collapsed = signal(false);
  protected theme = inject(ThemeService);
  protected readonly pinStyle = computed(() => this.theme.sidebar() === 'pin');
  /** Pin style, unpinned: a slim rail that slides open over the page while hovered (or focused). */
  protected readonly rail = computed(() => this.pinStyle() && !this.theme.sidebarPinned());
  protected readonly hoverOpen = signal(false);
  /** Classic style shrunk to icons with «. (The rail keeps its full layout and is simply clipped, so nothing reflows.) */
  protected readonly classicCollapsed = computed(() => !this.pinStyle() && this.collapsed());
  /** How much room the page leaves for the menu: a slim strip for the rail or a shrunk classic menu. */
  protected readonly narrow = computed(() => this.rail() || this.classicCollapsed());
  private closeTimer?: ReturnType<typeof setTimeout>;
  private readonly allNav: NavItem[] = [
    { path: '/', label: 'Overview', icon: 'overview', exact: true },
    { path: '/pay', label: 'Need to pay', icon: 'checklist', badge: true },
    { path: '/cards', label: 'Credit cards', icon: 'card' },
    { path: '/installments', label: 'Installments', icon: 'calendar-check' },
    { path: '/people', label: 'People', icon: 'people' },
    { path: '/sudden', label: 'Sudden spends', icon: 'bolt' },
    { path: '/daily', label: 'Daily spends', icon: 'cup' },
    { path: '/year', label: 'Year view', icon: 'chart' },
    { path: '/admin', label: 'Admin', icon: 'shield', admin: true },
  ];
  private readonly inApp = isInstalledApp();
  /** Admin-only items are hidden from everyone else, and from the installed phone app (web-only). */
  protected readonly nav = computed(() => this.allNav.filter((n) => !n.admin || (this.auth.account()?.isAdmin && !this.inApp)));

  protected open() {
    clearTimeout(this.closeTimer);
    if (this.rail()) this.hoverOpen.set(true);
  }

  protected closeSoon() {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.hoverOpen.set(false), CLOSE_DELAY_MS);
  }

  /** Keyboard: closes once focus moves out of the sidebar. */
  protected onFocusOut(e: FocusEvent, side: HTMLElement) {
    if (!side.contains(e.relatedTarget as Node | null)) this.closeSoon();
  }

  protected togglePin() {
    const pinned = !this.theme.sidebarPinned();
    this.theme.setSidebarPinned(pinned);
    this.hoverOpen.set(!pinned); // just unpinned with the pointer on it: stay open until it leaves
  }

  ngOnDestroy() { clearTimeout(this.closeTimer); }
}
