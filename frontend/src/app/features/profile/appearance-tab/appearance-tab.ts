import { Component, computed, inject } from '@angular/core';
import { ACCENT_PRESETS, DEFAULT_ACCENT, ThemeMode, ThemeService } from '../../../core/theme.service';
import { Icon, IconName } from '../../../shared/ui/icon/icon';

/** Light / dark theme and the accent colour (presets or any colour from the palette). */
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
  protected readonly presets = ACCENT_PRESETS;
  protected readonly defaultAccent = DEFAULT_ACCENT;
  /** A colour picked from the palette that isn't one of the presets. */
  protected readonly isCustom = computed(() => !this.presets.some((p) => p.hex === this.theme.accent()));

  protected pickCustom(value: string) {
    if (/^#[0-9a-f]{6}$/i.test(value)) this.theme.accent.set(value.toUpperCase());
  }
}
