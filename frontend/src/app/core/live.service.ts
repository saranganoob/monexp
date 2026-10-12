import { DOCUMENT, Injectable, OnDestroy, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AppStore } from './app-store';

/** Random id for this browser tab – sent with every request so the server can tell us apart. */
// (randomUUID only exists on https/localhost – a phone opening the local dev site over http gets the fallback.)
export const CLIENT_ID = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const CLIENT_HEADER = 'X-MonEXP-Client';
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30_000;

/** Adds this tab's id to API requests. */
export const clientIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.url.startsWith('/api') ? req.clone({ setHeaders: { [CLIENT_HEADER]: CLIENT_ID } }) : req);

/**
 * Live updates: keeps a WebSocket to the server while signed in. When the same account
 * changes something on another tab or device, the server says so and this page reloads.
 * Provided by the Shell, so it connects on sign-in and closes on sign-out.
 */
@Injectable()
export class LiveService implements OnDestroy {
  private store = inject(AppStore);
  private doc = inject(DOCUMENT);
  private ws?: WebSocket;
  private retryMs = RETRY_MIN_MS;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private everConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    const loc = this.doc.location;
    const ws = new WebSocket(`${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/api/live`);
    this.ws = ws;
    ws.onopen = () => {
      // After a dropped connection (Wi-Fi, server asleep) we may have missed changes.
      if (this.everConnected) this.store.reload();
      this.everConnected = true;
      this.retryMs = RETRY_MIN_MS;
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'changed' && msg.from !== CLIENT_ID) this.store.reload();
      } catch { /* not ours – ignore */ }
    };
    ws.onclose = () => {
      if (this.stopped) return;
      this.retryTimer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
    };
  }

  ngOnDestroy() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
  }
}
