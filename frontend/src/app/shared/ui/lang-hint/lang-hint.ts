import { Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/theme.service';
import { HINTS, HintKey } from '../../../core/i18n/home-language';
import { HomeLang } from '../../../core/models';

/**
 * A small line in the person's home language under an English label (see Profile → Preferences).
 * Shows nothing when no home language is chosen. `lang` = force a language (the Preferences preview).
 */
@Component({
  selector: 'app-lang-hint',
  template: `@if (text(); as t) { <span class="lang-hint" [attr.lang]="code()">{{ t }}</span> }`,
  styles: `:host { display: contents; }`,
})
export class LangHint {
  private theme = inject(ThemeService);
  readonly key = input.required<HintKey>();
  readonly lang = input<HomeLang | null | undefined>(undefined);
  protected readonly code = computed(() => (this.lang() === undefined ? this.theme.lang() : this.lang()));
  protected readonly text = computed(() => { const c = this.code(); return c ? HINTS[c][this.key()] : ''; });
}
