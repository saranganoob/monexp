import { Injectable, computed, signal } from '@angular/core';

/** Spinners only appear for actions slower than this – quick ones don't flicker. */
export const SPINNER_DELAY_MS = 300;

/**
 * Which actions are running, keyed by an action id (e.g. "bill:123", "add-expense").
 * `isPending` → disable at once (no double submit); `isSlow` → show the spinner (after 300ms).
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal<ReadonlySet<string>>(new Set());
  private readonly slow = signal<ReadonlySet<string>>(new Set());

  /** Something has been running for a while – for the screen-reader "Saving…" announcement. */
  readonly anySlow = computed(() => this.slow().size > 0);

  isPending(key: string) { return this.pending().has(key); }
  isSlow(key: string) { return this.slow().has(key); }

  /** Runs `work` while `key` is marked as busy. */
  async track<T>(key: string, work: () => Promise<T>): Promise<T> {
    this.pending.update((s) => new Set(s).add(key));
    const timer = setTimeout(() => this.slow.update((s) => new Set(s).add(key)), SPINNER_DELAY_MS);
    try {
      return await work();
    } finally {
      clearTimeout(timer);
      const drop = (s: ReadonlySet<string>) => { const n = new Set(s); n.delete(key); return n; };
      this.pending.update(drop);
      this.slow.update(drop);
    }
  }
}
