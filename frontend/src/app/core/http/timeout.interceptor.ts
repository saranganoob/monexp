import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';

/** A change that hasn't answered in this time is treated as failed (the user gets Retry). */
export const SAVE_TIMEOUT_MS = 10_000;
/** Signing in may have to wait for the free server to wake up (up to about a minute). */
const SIGN_IN_TIMEOUT_MS = 75_000;
const SIGN_IN_URLS = ['/auth/login', '/auth/otp/'];
export const CONNECTION_MESSAGE = 'Couldn’t save. Check your connection.';

/**
 * Changes (POST / PATCH / PUT / DELETE) give up after 10 seconds, and a lost connection reads
 * "Couldn't save. Check your connection." Reads have no limit: the free server can take up
 * to a minute to wake up – signing in gets that long too. The AI chat streams, so it's left alone.
 */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || req.url.includes('/ai/')) return next(req);
  return next(req).pipe(
    timeout(SIGN_IN_URLS.some((u) => req.url.includes(u)) ? SIGN_IN_TIMEOUT_MS : SAVE_TIMEOUT_MS),
    catchError((err) => {
      if (err instanceof TimeoutError || (err instanceof HttpErrorResponse && err.status === 0)) {
        return throwError(() => new HttpErrorResponse({ status: 0, url: req.url, error: { error: CONNECTION_MESSAGE } }));
      }
      return throwError(() => err);
    }),
  );
};
