import { Component, computed, inject, signal } from '@angular/core';
import { COLOR_NAMES, NamedColor, searchColors } from '../../../core/utils/color-names';
import { ACCENT_PRESETS, BudgetRule, DEFAULT_ACCENT, DEFAULT_AI_NAME, ThemeMode, ThemeService } from '../../../core/theme.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AppStore } from '../../../core/app-store';
import { errorMessage } from '../../../core/api.service';
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
  private store = inject(AppStore);
  /** The balance switch being saved, and the one whose save failed (with why). */
  protected readonly ruleSaving = signal<BudgetRule | null>(null);
  protected readonly ruleError = signal<{ key: BudgetRule; message: string } | null>(null);
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
  /** The picked colour's name, when it's a preset or one of the named colours. */
  protected readonly currentName = computed(() => {
    const hex = this.theme.accent();
    return this.presets.find((p) => p.hex === hex)?.name ?? COLOR_NAMES.find((c) => c.hex === hex)?.name ?? '';
  });

  // ---- find a colour by name ----
  protected readonly query = signal('');
  protected readonly listOpen = signal(false);
  protected readonly active = signal(0); // highlighted suggestion (arrow keys)
  protected readonly matches = computed(() => searchColors(this.query()));
  protected readonly showList = computed(() => this.listOpen() && !!this.query().trim());

  protected readonly languages = HOME_LANGUAGES;
  protected readonly previewKeys = Object.keys(HINT_LABELS) as HintKey[];
  protected readonly hintLabels = HINT_LABELS;
  protected pickLang(code: HomeLang | null) { this.theme.setLang(code); }

  /** Daily or sudden spends in / out of the balance: saved, then every total reloads. */
  protected async setRule(key: BudgetRule, on: boolean) {
    const current = key === 'dailyInBudget' ? this.theme.dailyInBudget() : this.theme.suddenInBudget();
    if (on === current || this.ruleSaving()) return;
    this.ruleSaving.set(key);
    this.ruleError.set(null);
    try {
      await this.theme.setInBudget(key, on);
      this.store.reload();
    } catch (e) {
      this.ruleError.set({ key, message: errorMessage(e) });
    } finally {
      this.ruleSaving.set(null);
    }
  }
  protected saveAiName(name: string) {
    this.theme.setAiName(name);
    this.aiNameSaved.set(true);
  }

  protected pickCustom(value: string) {
    if (/^#[0-9a-f]{6}$/i.test(value)) this.theme.setAccent(value, { fade: false }); // dragging in the palette: no fade
  }

  protected search(value: string) {
    this.query.set(value);
    this.active.set(0);
    this.listOpen.set(true);
  }

  protected searchKey(e: KeyboardEvent) {
    const n = this.matches().length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.listOpen.set(true); this.active.set((this.active() + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.active.set((this.active() - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = this.matches()[this.active()]; if (c) this.pickNamed(c); }
    else if (e.key === 'Escape' && this.listOpen()) { e.stopPropagation(); this.listOpen.set(false); }
  }

  protected pickNamed(c: NamedColor) {
    this.theme.setAccent(c.hex);
    this.query.set('');
    this.listOpen.set(false);
  }

  protected closeSearchSoon(e: FocusEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) this.listOpen.set(false);
  }
}
