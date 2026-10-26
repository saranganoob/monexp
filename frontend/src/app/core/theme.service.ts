import { DOCUMENT, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Api } from './api.service';
import { AuthService } from './auth/auth.service';
import { HomeLang, Prefs } from './models';
import { accentTokens } from './utils/color';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'monexp-theme';
const ACCENT_KEY = 'monexp-accent';
const SAVE_DELAY_MS = 400; // dragging around the colour palette fires many changes – save once it settles
/** The design's blue. While it's picked, the hand-tuned values in styles/_tokens.scss are used. */
export const DEFAULT_ACCENT = '#235EDF';

/** Ready-made accent colours for the Appearance tab (the design's presets). */
export const ACCENT_PRESETS = [
  { name: 'Blue', hex: DEFAULT_ACCENT },
  { name: 'Ocean', hex: '#0EA5E9' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Graphite', hex: '#64748B' },
] as const;

const ACCENT_VARS = Object.keys(accentTokens(DEFAULT_ACCENT, 'light'));

/**
 * Light / dark look and the accent colour. Each person's choice is saved in their account, so it
 * follows them to every device; this browser also remembers the last one for the sign-in page.
 * Sets <html data-theme="…"> plus the accent CSS variables.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  private auth = inject(AuthService);
  private api = inject(Api);

  readonly mode = signal<ThemeMode>(this.read(STORAGE_KEY) === 'dark' ? 'dark' : 'light');
  readonly accent = signal<string>(this.savedAccent());
  /** Home-language hints (Tamil / Telugu / Hindi), or null for English only. Saved on the account. */
  readonly lang = signal<HomeLang | null>(null);

  private appliedFor: string | null = null; // whose saved look is showing
  private pending: Partial<Prefs> = {};
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Paint the page with the current choice.
    effect(() => {
      const mode = this.mode();
      const accent = this.accent();
      const root = this.doc.documentElement;
      root.dataset['theme'] = mode;
      if (accent === DEFAULT_ACCENT) {
        for (const name of ACCENT_VARS) root.style.removeProperty(name);
      } else {
        for (const [name, value] of Object.entries(accentTokens(accent, mode))) root.style.setProperty(name, value);
      }
      this.write(STORAGE_KEY, mode);
      this.write(ACCENT_KEY, accent);
    });

    // Someone signed in: switch to their own saved look (once per sign-in).
    effect(() => {
      const account = this.auth.account();
      untracked(() => {
        const who = account ? account.email || account.phone : null;
        if (who === this.appliedFor) return;
        this.appliedFor = who;
        if (!account) { this.lang.set(null); return; } // signed out: the sign-in page keeps the last look on this device
        // Their own choice, or the default look if they haven't picked one – never the previous person's.
        this.mode.set(account.prefs?.theme ?? 'light');
        this.accent.set(account.prefs?.accent ?? DEFAULT_ACCENT);
        this.lang.set(account.prefs?.lang ?? null);
      });
    });
  }

  setMode(mode: ThemeMode) {
    this.mode.set(mode);
    this.save({ theme: mode });
  }

  setAccent(hex: string) {
    this.accent.set(hex.toUpperCase());
    this.save({ accent: hex.toUpperCase() });
  }

  setLang(lang: HomeLang | null) {
    this.lang.set(lang);
    this.save({ lang });
  }

  /** Saves to the signed-in account (a moment after the last change). */
  private save(change: Partial<Prefs>) {
    if (!this.auth.account()) return;
    Object.assign(this.pending, change);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      const body = this.pending;
      this.pending = {};
      try {
        await this.api.updatePrefs(body);
      } catch {
        /* offline or signed out – the change still applies on this device */
      }
    }, SAVE_DELAY_MS);
  }

  private savedAccent(): string {
    const v = this.read(ACCENT_KEY);
    return v && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : DEFAULT_ACCENT;
  }

  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private write(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* private window: keep it for this visit only */ }
  }
}
