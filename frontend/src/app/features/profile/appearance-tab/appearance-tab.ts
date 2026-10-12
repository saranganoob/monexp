import { Component, inject } from '@angular/core';
import { ThemeMode, ThemeService } from '../../../core/theme.service';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

/** Light / dark theme picker. */
@Component({
  selector: 'app-appearance-tab',
  imports: [Icon],
  templateUrl: './appearance-tab.html',
  styleUrl: './appearance-tab.scss',
})
export class AppearanceTab {
  protected theme = inject(ThemeService);
  protected readonly options: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: 'light', label: 'Light', icon: 'sun' },
    { mode: 'dark', label: 'Dark', icon: 'moon' },
  ];
}
