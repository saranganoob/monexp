import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme.service';
import { FULL_MONTHS, ymMonth0 } from '../../core/utils/format';
import { displayName, firstName, initials } from '../../core/utils/name';
import { isInstalledApp } from '../../core/utils/platform';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Top right: your initials inside a ring that fills as the month's bills are paid, and your first name
 * (initials only on phones). Opens a small menu: who's signed in, Profile, light/dark, Sign out.
 */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink, Icon],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
  host: {
    '(document:click)': 'outside($event)',
    '(document:keydown.escape)': 'close(true)',
  },
})
export class UserMenu {
  private store = inject(AppStore);
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected theme = inject(ThemeService);

  protected readonly inApp = isInstalledApp();
  protected readonly open = signal(false);

  protected readonly name = computed(() => displayName(this.auth.account()));
  protected readonly first = computed(() => firstName(this.name()));
  protected readonly letters = computed(() => initials(this.name()));
  protected readonly login = computed(() => this.auth.account()?.email || this.auth.account()?.phone || '');

  // ---- the ring: bills paid in the month on screen (skipped bills don't count – same as Overview) ----
  protected readonly bills = computed(() => {
    const t = this.store.month()?.totals;
    const total = t ? t.paidCount + t.unpaidCount : 0;
    if (!t || !total) return null;
    const pct = Math.round((t.paidCount / total) * 100);
    return { paid: t.paidCount, total, pct, done: t.paidCount === total, month: FULL_MONTHS[ymMonth0(this.store.ym())] };
  });
  /** How much of the ring is drawn (0–100). Starts empty and grows in once the page has shown. */
  private readonly ready = signal(false);
  protected readonly fill = computed(() => (this.ready() ? this.bills()?.pct ?? 0 : 0));
  protected readonly label = computed(() => {
    const b = this.bills();
    return b ? `${this.name()} – ${b.month}: ${b.paid} of ${b.total} bills paid` : this.name();
  });

  constructor() {
    // Let the ring paint empty first, then fill – so it sweeps round instead of appearing.
    // (A timer, not an animation frame: frames pause in background tabs and the ring would stay empty.)
    setTimeout(() => this.ready.set(true), 150);
  }

  protected toggle() {
    this.open.update((o) => !o);
    if (this.open()) setTimeout(() => this.items()[0]?.focus());
  }

  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLElement>('.chip')?.focus();
  }

  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  /** Arrow keys move between the menu items. */
  protected keys(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = this.items();
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  private items() { return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]')]; }

  protected toggleMode() { this.theme.setMode(this.theme.mode() === 'dark' ? 'light' : 'dark'); }

  protected async signOut() {
    this.close();
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
