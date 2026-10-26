import { Api } from '../../core/api.service';
import { AppStore } from '../../core/app-store';
import { Entry } from '../../core/models';

/** Action key while an entry's "Mark received / paid back" is saving (for its button spinner). */
export const entryKey = (r: Entry) => `entry:${r.id}`;

/** Mark received / paid back, or back to pending. Friend EMI rows are stored on the month. */
export function toggleEntry(api: Api, store: AppStore, r: Entry) {
  const next = r.status === 'done' ? 'pending' : 'done';
  const ym = store.ym();
  return store.run(() => (r.emiId
    ? api.setEmiMonth(ym, r.emiId, { received: next })
    : api.updateEntry(r.id, { status: next })), { key: entryKey(r) });
}
