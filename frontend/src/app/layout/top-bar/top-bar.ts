import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppStore } from '../../core/app-store';
import { ThemeService } from '../../core/theme.service';
import { todayLabel } from '../../core/utils/format';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { Icon } from '../../shared/ui/icon/icon';
import { isInstalledApp } from '../../core/utils/platform';

/** "Today · …", the Calculator button (web, if switched on), the Profile button (website only) and Sign out. */
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive, Avatar, Icon],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  private auth = inject(AuthService);
  private router = inject(Router);
  protected store = inject(AppStore);
  protected theme = inject(ThemeService);
  protected readonly today = todayLabel();
  protected readonly who = computed(() => this.auth.account()?.email || 'Me');
  protected readonly inApp = isInstalledApp();

  async signOut() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
