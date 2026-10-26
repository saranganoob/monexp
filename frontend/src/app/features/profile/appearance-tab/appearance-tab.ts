import { Component, computed, inject } from '@angular/core';
import { ACCENT_PRESETS, DEFAULT_ACCENT, ThemeMode, ThemeService } from '../../../core/theme.service';
import { Icon, IconName } from '../../../shared/ui/icon/icon';
import { LangHint } from '../../../shared/ui/lang-hint/lang-hint';
import { HINT_LABELS, HOME_LANGUAGES, HintKey } from '../../../core/i18n/home-language';
import { HomeLang } from '../../../core/models';

/** Preferences: light / dark theme, accent colour, and home-language hints. */
@Component({
  selector: 'app-appearance-tab',
  imports: [Icon, LangHint],
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

  protected readonly languages = HOME_LANGUAGES;
  protected readonly previewKeys = Object.keys(HINT_LABELS) as HintKey[];
  protected readonly hintLabels = HINT_LABELS;
  protected pickLang(code: HomeLang | null) { this.theme.setLang(code); }

  protected pickCustom(value: string) {
    if (/^#[0-9a-f]{6}$/i.test(value)) this.theme.setAccent(value);
  }
}
