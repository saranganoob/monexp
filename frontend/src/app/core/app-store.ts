import { DOCUMENT, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, errorMessage } from './api.service';
import { AuthService } from './auth/auth.service';
import { Card, CardEmi, ChangeResult, MonthData, MonthView, PersonStats } from './models';
import { currentYm } from './utils/format';

const YM_KEY = 'monexp.ym';
/** Other open MonEXP tabs in this browser hear about changes on this channel. */
const SYNC_CHANNEL = 'monexp-sync';
/** Coming back to a tab within this many ms of the last refresh doesn't fetch again. */
const REFRESH_GAP_MS = 2000;
function savedYm(): string | null {
  try {
    const v = sessionStorage.getItem(YM_KEY);
    return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export interface Toast { message: string; undoToken?: string; error?: boolean; }
export type AddType = 'bill' | 'sudden' | 'in' | 'out';

/**
 * App-wide state: the selected month, its data from the backend, and the
 * cards / EMIs / people lists. Everything reloads after any change – in this tab, in the
 * other open tabs, and whenever you come back to a tab.
 */
@Injectable({ providedIn: 'root' })
export class AppStore {
  private api = inject(Api);
  private auth = inject(AuthService);
  private doc = inject(DOCUMENT);
  private channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(SYNC_CHANNEL);
  private lastRefresh = 0;

  /** Selected month – remembered for this browser tab, so a refresh stays on it. */
  readonly ym = signal(savedYm() ?? currentYm());
  readonly view = signal<MonthView | null>(null);
  readonly loadError = signal('');
  /** Bumped after every change so all screens reload. */
  readonly version = signal(0);

  readonly cards = signal<Card[]>([]);
  readonly emis = signal<CardEmi[]>([]);
  readonly people = signal<PersonStats[]>([]);

  readonly toast = signal<Toast | null>(null);
  readonly dialog = signal<{ type: AddType } | null>(null);
  readonly askAiOpen = signal(false);

  /** The month's data, or null if it isn't set up yet / still loading. */
  readonly month = computed(() => { const v = this.view(); return v && v.exists ? (v as MonthData) : null; });
  readonly unpaidCount = computed(() => this.month()?.totals.unpaidCount ?? 0);

  private loadSeq = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const ym = this.ym();
      this.version();
      // A different account signing in must never see the previous one's data.
      const who = this.auth.account();
      try { sessionStorage.setItem(YM_KEY, ym); } catch { /* storage blocked – not important */ }
      untracked(() => (who ? this.load(ym) : this.clear()));
    });

    // Another tab changed something: show it here too.
    this.channel?.addEventListener('message', (e) => { if (e.data === 'changed' && this.auth.account()) this.reload(); });
    // Back to this tab or window: fetch fresh data (it may have changed on another device).
    const onReturn = () => {
      if (this.doc.visibilityState !== 'visible' || !this.auth.account() || Date.now() - this.lastRefresh < REFRESH_GAP_MS) return;
      this.reload();
    };
    this.doc.addEventListener('visibilitychange', onReturn);
    this.doc.defaultView?.addEventListener('focus', onReturn);
  }

  /** Forgets everything loaded (on sign-out). */
  private clear() {
    this.loadSeq++; // drop any load still on its way
    this.view.set(null);
    this.cards.set([]);
    this.emis.set([]);
    this.people.set([]);
    this.loadError.set('');
    this.toast.set(null);
    this.dialog.set(null);
    this.askAiOpen.set(false);
  }

  private async load(ym: string) {
    const seq = ++this.loadSeq;
    this.lastRefresh = Date.now();
    try {
      const [view, cards, emis, people] = await Promise.all([this.api.month(ym), this.api.cards(), this.api.emis(), this.api.people(ym)]);
      if (seq !== this.loadSeq) return; // a newer load started meanwhile
      this.view.set(view);
      this.cards.set(cards);
      this.emis.set(emis);
      this.people.set(people);
      this.loadError.set('');
    } catch (err) {
      if (seq === this.loadSeq) this.loadError.set(errorMessage(err));
    }
  }

  reload() { this.version.update((v) => v + 1); }

  /**
   * Sends a change to the backend. On success shows the "… · Undo" toast and reloads.
   * Returns null on success, or the error message (also shown as a toast unless `quiet`).
   */
  async run(request: Promise<ChangeResult>, { quiet = false } = {}): Promise<string | null> {
    try {
      const res = await request;
      this.showToast({ message: res.message, undoToken: res.undoToken });
      this.reload();
      this.channel?.postMessage('changed');
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      if (!quiet) this.showToast({ message: msg, error: true });
      return msg;
    }
  }

  async undo() {
    const token = this.toast()?.undoToken;
    if (!token) return;
    try {
      const res = await this.api.undo(token);
      this.showToast({ message: res.message });
    } catch (err) {
      this.showToast({ message: errorMessage(err), error: true });
    }
    this.reload();
    this.channel?.postMessage('changed');
  }

  showToast(t: Toast) {
    clearTimeout(this.toastTimer);
    this.toast.set(t);
    this.toastTimer = setTimeout(() => this.toast.set(null), t.undoToken ? 8000 : 5000);
  }

  openAdd(type: AddType = 'bill') { this.dialog.set({ type }); }
}
