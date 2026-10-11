import { Api } from '../../core/api.service';
import { AppStore } from '../../core/app-store';
import { Entry } from '../../core/models';

/** Mark received / paid back, or back to pending. Friend card-EMI rows are stored on the month. */
export function toggleEntry(api: Api, store: AppStore, r: Entry) {
  const next = r.status === 'done' ? 'pending' : 'done';
  return store.run(r.emiId
    ? api.setEmiMonth(store.ym(), r.emiId, { received: next })
    : api.updateEntry(r.id, { status: next }));
}
