import { DOCUMENT, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Api } from './api.service';
import { AuthService } from './auth/auth.service';
import { HomeLang, Prefs, SidebarStyle } from './models';
import { accentTokens } from './utils/color';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'monexp-theme';
const ACCENT_KEY = 'monexp-accent';
const SAVE_DELAY_MS = 400; // dragging around the colour palette fires many changes – save once it settles
/** The design's blue. While it's picked, the hand-tuned values in styles/_tokens.scss are used. */
export const DEFAULT_ACCENT = '#235EDF';
/** The AI's name unless the person picks their own (Tamil for "accounts"). */
export const DEFAULT_AI_NAME = 'Kanakku';

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
 * follows them to every device; this browser also remembers it so the app opens in it straight away.
 * The sign-in page always uses the default look.
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
  /** Web sidebar: 'classic' (« shrinks it) or 'pin' (pinned open, or a slim rail that opens on hover). */
  readonly sidebar = signal<SidebarStyle>('classic');
  readonly sidebarPinned = signal(true);
  /** What this person calls the AI (Profile → Preferences). */
  readonly aiName = signal(DEFAULT_AI_NAME);

  private appliedFor: string | null | undefined = undefined; // whose saved look is showing (null = signed out, undefined = none yet)
  private pending: Partial<Prefs> = {};
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Paint the page with the current choice.
    effect(() => this.paint(this.mode(), this.accent()));

    // Someone signed in: switch to their own saved look (once per sign-in).
    effect(() => {
      const account = this.auth.account();
      if (account === undefined) return; // not checked yet – keep the remembered look for the first paint
      untracked(() => {
        const who = account ? account.email || account.phone : null;
        if (who === this.appliedFor) return;
        this.appliedFor = who;
        if (!account) {
          // Signed out: the sign-in page always shows MonEXP's own look (light, blue) – never the last person's colours.
          this.mode.set('light');
          this.accent.set(DEFAULT_ACCENT);
          this.lang.set(null); this.sidebar.set('classic'); this.sidebarPinned.set(true); this.aiName.set(DEFAULT_AI_NAME);
          return;
        }
        // Their own choice, or the default look if they haven't picked one – never the previous person's.
        this.mode.set(account.prefs?.theme ?? 'light');
        this.accent.set(account.prefs?.accent ?? DEFAULT_ACCENT);
        this.lang.set(account.prefs?.lang ?? null);
        this.sidebar.set(account.prefs?.sidebar ?? 'classic');
        this.sidebarPinned.set(account.prefs?.sidebarPinned ?? true);
        this.aiName.set(account.prefs?.aiName || DEFAULT_AI_NAME);
      });
    });
  }

  setMode(mode: ThemeMode) {
    this.fade(() => this.mode.set(mode));
    this.save({ theme: mode });
  }

  /** `fade: false` while dragging in the colour palette – a fade on every tiny move would feel laggy. */
  setAccent(hex: string, { fade = true } = {}) {
    const change = () => this.accent.set(hex.toUpperCase());
    if (fade) this.fade(change); else change();
    this.save({ accent: hex.toUpperCase() });
  }

  private paint(mode: ThemeMode, accent: string) {
    const root = this.doc.documentElement;
    root.dataset['theme'] = mode;
    if (accent === DEFAULT_ACCENT) {
      for (const name of ACCENT_VARS) root.style.removeProperty(name);
    } else {
      for (const [name, value] of Object.entries(accentTokens(accent, mode))) root.style.setProperty(name, value);
    }
    // Remembered for a quick first paint when the signed-in app opens again (not for the sign-in page's default look).
    if (untracked(() => this.auth.account()) !== null) {
      this.write(STORAGE_KEY, mode);
      this.write(ACCENT_KEY, accent);
    }
  }

  /**
   * Gently cross-fades the whole page to the new look (styles.scss sets the timing). Browsers without
   * view transitions, and people who asked for less motion, get the change straight away.
   */
  private fade(change: () => void) {
    const doc = this.doc as Document & { startViewTransition?: (update: () => void) => unknown };
    const reduce = this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduce) return change();
    doc.startViewTransition(() => {
      change();
      this.paint(this.mode(), this.accent()); // paint now, inside the transition (the effect would run a moment later)
    });
  }

  setLang(lang: HomeLang | null) {
    this.lang.set(lang);
    this.save({ lang });
  }

  setSidebar(style: SidebarStyle) {
    this.sidebar.set(style);
    this.save({ sidebar: style });
  }

  setSidebarPinned(pinned: boolean) {
    this.sidebarPinned.set(pinned);
    this.save({ sidebarPinned: pinned });
  }

  /** An empty name goes back to the default. */
  setAiName(name: string) {
    const clean = name.replace(/\s+/g, ' ').trim();
    this.aiName.set(clean || DEFAULT_AI_NAME);
    this.save({ aiName: clean && clean !== DEFAULT_AI_NAME ? clean : null });
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
