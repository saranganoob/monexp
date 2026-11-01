import { Component, inject } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { ThemeService } from '../../core/theme.service';
import { todayLabel } from '../../core/utils/format';
import { Icon } from '../../shared/ui/icon/icon';
import { UserMenu } from '../user-menu/user-menu';

/** "Today · …", the Calculator button (web, if switched on) and your name with its menu (Profile, light/dark, Sign out). */
@Component({
  selector: 'app-top-bar',
  imports: [Icon, UserMenu],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  protected store = inject(AppStore);
  protected theme = inject(ThemeService);
  protected readonly today = todayLabel();
}
