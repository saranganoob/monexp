import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme.service';
import { Icon } from '../../shared/ui/icon/icon';
import { isInstalledApp } from '../../core/utils/platform';
import { ADMIN_ITEM, MenuItem, OVERVIEW_ITEM, menuItem } from '../../core/nav';

/** How long the pointer can leave the hover sidebar before it closes (so it doesn't flicker). */
const CLOSE_DELAY_MS = 120;

/**
 * Left navigation; a bottom bar on phones. Two web styles, saved per user: classic, or pin & hover.
 * Sections and their order come from Profile → Menu (same on phone and computer).
 */
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
  private readonly inApp = isInstalledApp();
  /**
   * Overview, then the person's own sections in their order (switched-off ones left out), then Admin –
   * only for the admin, and not in the installed phone app (web-only).
   */
  protected readonly nav = computed<MenuItem[]>(() => {
    const hidden = this.theme.navHidden();
    const own = this.theme.navOrder().filter((k) => !hidden.includes(k)).map(menuItem);
    const admin = this.auth.account()?.isAdmin && !this.inApp ? [ADMIN_ITEM] : [];
    return [OVERVIEW_ITEM, ...own, ...admin];
  });

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
