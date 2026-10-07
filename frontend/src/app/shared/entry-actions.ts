import { Api } from '../core/api.service';
import { Store } from '../core/store';
import { Entry } from '../core/models';

/** Mark received / paid back, or back to pending. Friend card-EMI rows live on the month instead. */
export function toggleEntry(api: Api, store: Store, r: Entry) {
  const next = r.status === 'done' ? 'pending' : 'done';
  return store.run(r.emiId
    ? api.setEmiMonth(store.ym(), r.emiId, { received: next })
    : api.updateEntry(r.id, { status: next }));
}
