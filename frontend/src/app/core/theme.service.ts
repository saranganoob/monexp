import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { accentTokens } from './utils/color';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'monexp-theme';
const ACCENT_KEY = 'monexp-accent';
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
 * Light / dark look and the accent colour. Sets <html data-theme="…"> plus the accent CSS
 * variables, and remembers both on this device.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.read(STORAGE_KEY) === 'dark' ? 'dark' : 'light');
  readonly accent = signal<string>(this.savedAccent());

  constructor() {
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
