import { DOCUMENT, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, errorMessage, isConnectionError } from './api.service';
import { LoadingService, SPINNER_DELAY_MS } from './loading.service';
import { CONNECTION_MESSAGE } from './http/timeout.interceptor';
import { AuthService } from './auth/auth.service';
import { Bill, Card, CardEmi, ChangeResult, MonthData, MonthView, PersonStats } from './models';
import { currentYm } from './utils/format';

const YM_KEY = 'monexp.ym';
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

export interface Toast { message: string; undoToken?: string; error?: boolean; retry?: () => void; }
/** A change to send: a function (can be retried after a connection failure) or a request already sent. */
export type ChangeRequest = (() => Promise<ChangeResult>) | Promise<ChangeResult>;
export interface RunOptions {
  /** Don't show failures as a toast (the form shows them itself). */
  quiet?: boolean;
  /** Action id: buttons/ticks with this key show a spinner, and a second click is ignored until it's done. */
  key?: string;
}
export type AddType = 'bill' | 'sudden' | 'in' | 'out';

/**
 * App-wide state: the selected month, its data from the backend, and the
 * cards / EMIs / people lists. Everything reloads after any change – in this tab, on the
 * account's other tabs and devices (LiveService), and whenever you come back to a tab.
 */
@Injectable({ providedIn: 'root' })
export class AppStore {
  private api = inject(Api);
  private auth = inject(AuthService);
  private doc = inject(DOCUMENT);
  readonly loading = inject(LoadingService);
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
  /** The "Add EMI / installment" dialog; cardId pre-selects "Paid from" (null = bank / cash). */
  readonly emiDialog = signal<{ cardId: string | null } | null>(null);
  readonly askAiOpen = signal(false);

  /** The month's data, or null if it isn't set up yet / still loading. */
  readonly month = computed(() => { const v = this.view(); return v && v.exists ? (v as MonthData) : null; });
  readonly unpaidCount = computed(() => this.month()?.totals.unpaidCount ?? 0);

  /** The month's data is loading and has taken longer than 300ms (time for the skeleton). */
  private readonly loadingSlow = signal(false);
  /** Show placeholders instead of the page: still loading after 300ms and what's on screen is for another month. */
  readonly showSkeleton = computed(() => this.loadingSlow() && this.view()?.ym !== this.ym());

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
    this.emiDialog.set(null);
    this.askAiOpen.set(false);
  }

  private async load(ym: string) {
    const seq = ++this.loadSeq;
    this.lastRefresh = Date.now();
    const slowTimer = setTimeout(() => { if (seq === this.loadSeq) this.loadingSlow.set(true); }, SPINNER_DELAY_MS);
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
    } finally {
      clearTimeout(slowTimer);
      if (seq === this.loadSeq) this.loadingSlow.set(false);
    }
  }

  reload() { this.version.update((v) => v + 1); }

  /**
   * Sends a change to the backend. On success shows the "… · Undo" toast and reloads.
   * Returns null on success, or the error message (also shown as a toast unless `quiet`).
   * With a `key`, the action shows its spinner and can't be sent twice at once.
   * If the connection fails, the toast offers Retry (when the change was given as a function).
   */
  async run(request: ChangeRequest, opts: RunOptions = {}): Promise<string | null> {
    const { quiet = false, key } = opts;
    if (key && this.loading.isPending(key)) return 'Still saving…';
    const send = () => (typeof request === 'function' ? request() : request);
    try {
      const res = await (key ? this.loading.track(key, send) : send());
      this.showToast({ message: res.message, undoToken: res.undoToken });
      this.reload();
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      if (isConnectionError(err)) {
        // Nothing was changed on screen before the answer, so there's nothing to roll back.
        const retry = typeof request === 'function' ? () => { this.toast.set(null); void this.run(request, opts); } : undefined;
        this.showToast({ message: CONNECTION_MESSAGE, error: true, retry });
      } else if (!quiet) {
        this.showToast({ message: msg, error: true });
      }
      return msg;
    }
  }

  /** Mark a Need-to-pay row paid / unpaid – whichever record it really is (bill, bank EMI, money I owe). */
  togglePaid(b: Bill, ym: string, paid = b.status !== 'paid') {
    const key = `bill:${b.id}`;
    if (b.kind === 'emi' && b.emiId) return this.run(() => this.api.setEmiMonth(ym, b.emiId!, { paid: paid ? 'paid' : 'unpaid' }), { key });
    if (b.kind === 'owe' && b.entryId) return this.run(() => this.api.updateEntry(b.entryId!, { status: paid ? 'done' : 'pending' }), { key });
    return this.run(() => this.api.updateBill(b.id, { status: paid ? 'paid' : 'unpaid' }), { key });
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
  }

  showToast(t: Toast) {
    clearTimeout(this.toastTimer);
    this.toast.set(t);
    this.toastTimer = setTimeout(() => this.toast.set(null), t.undoToken || t.retry ? 8000 : 5000);
  }

  openAdd(type: AddType = 'bill') { this.dialog.set({ type }); }
  openEmi(cardId: string | null = null) { this.emiDialog.set({ cardId }); }
}
