import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'monexp-theme';

/** Light / dark look. Sets <html data-theme="…"> and remembers the choice on this device. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private doc = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.saved());

  constructor() {
    effect(() => {
      const mode = this.mode();
      this.doc.documentElement.dataset['theme'] = mode;
      try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private window: keep it for this visit only */ }
    });
  }

  private saved(): ThemeMode {
    try { return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  }
}
