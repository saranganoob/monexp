import { Component, computed, inject, signal } from '@angular/core';
import { ACCENT_PRESETS, DEFAULT_ACCENT, DEFAULT_AI_NAME, ThemeMode, ThemeService } from '../../../core/theme.service';
import { AuthService } from '../../../core/auth/auth.service';
import { SidebarStyle } from '../../../core/models';
import { Icon, IconName } from '../../../shared/ui/icon/icon';
import { LangHint } from '../../../shared/ui/lang-hint/lang-hint';
import { HINT_LABELS, HOME_LANGUAGES, HintKey } from '../../../core/i18n/home-language';
import { HomeLang } from '../../../core/models';

/** Preferences: light / dark theme, sidebar style, accent colour, home-language hints and the AI's name. */
@Component({
  selector: 'app-appearance-tab',
  imports: [Icon, LangHint],
  templateUrl: './appearance-tab.html',
  styleUrl: './appearance-tab.scss',
})
export class AppearanceTab {
  protected theme = inject(ThemeService);
  protected auth = inject(AuthService);
  protected readonly defaultAiName = DEFAULT_AI_NAME;
  protected readonly aiNameSaved = signal(false);
  protected readonly options: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: 'light', label: 'Light', icon: 'sun' },
    { mode: 'dark', label: 'Dark', icon: 'moon' },
  ];
  protected readonly sidebarOptions: { style: SidebarStyle; label: string; icon: IconName }[] = [
    { style: 'classic', label: 'Classic', icon: 'sidebar-left' },
    { style: 'pin', label: 'Pin & hover', icon: 'pin' },
  ];
  protected readonly presets = ACCENT_PRESETS;
  protected readonly defaultAccent = DEFAULT_ACCENT;
  /** A colour picked from the palette that isn't one of the presets. */
  protected readonly isCustom = computed(() => !this.presets.some((p) => p.hex === this.theme.accent()));

  protected readonly languages = HOME_LANGUAGES;
  protected readonly previewKeys = Object.keys(HINT_LABELS) as HintKey[];
  protected readonly hintLabels = HINT_LABELS;
  protected pickLang(code: HomeLang | null) { this.theme.setLang(code); }
  protected saveAiName(name: string) {
    this.theme.setAiName(name);
    this.aiNameSaved.set(true);
  }

  protected pickCustom(value: string) {
    if (/^#[0-9a-f]{6}$/i.test(value)) this.theme.setAccent(value);
  }
}
