import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStore } from '../../core/app-store';
import { AuthService } from '../../core/auth/auth.service';
import { Icon, IconName } from '../../shared/ui/icon/icon';

interface NavItem { path: string; label: string; icon: IconName; exact?: boolean; badge?: boolean; admin?: boolean; }

/** Left navigation (a scrolling top bar on phones). */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected store = inject(AppStore);
  protected auth = inject(AuthService);
  /** Icon-only rail on wide screens (the toggle is hidden on phones). */
  protected readonly collapsed = signal(false);
  private readonly allNav: NavItem[] = [
    { path: '/', label: 'Overview', icon: 'overview', exact: true },
    { path: '/pay', label: 'Need to pay', icon: 'checklist', badge: true },
    { path: '/cards', label: 'Credit cards', icon: 'card' },
    { path: '/installments', label: 'Installments', icon: 'calendar-check' },
    { path: '/people', label: 'People', icon: 'people' },
    { path: '/sudden', label: 'Sudden spends', icon: 'bolt' },
    { path: '/year', label: 'Year view', icon: 'chart' },
    { path: '/admin', label: 'Admin', icon: 'shield', admin: true },
  ];
  /** Admin-only items are hidden from everyone else. */
  protected readonly nav = computed(() => this.allNav.filter((n) => !n.admin || this.auth.account()?.isAdmin));
}
