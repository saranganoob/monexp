// One-off upgrade from the single-user version: data saved before accounts were separated
// has no owner, so it is given to the first account ever created (the original owner).
// Also replaces the old "one month per database" unique index with "one month per user".
// Safe to run on every start – it does nothing once everything has an owner.
import { User, MONEY_MODELS, Card, BillItem, Month } from '../models/index.js';
import { runAsOwner, runUnscoped } from '../lib/owner.js';
import { nextSortOrder } from './monthService.js';

/** If nobody is an admin yet, the first account ever created (the original owner) becomes one. */
export async function ensureAdmin() {
  if (await User.exists({ isAdmin: true })) return null;
  const first = await User.findOne().sort({ createdAt: 1, _id: 1 });
  if (!first) return null;
  first.isAdmin = true;
  await first.save();
  return first.email || first.phone;
}

export function assignUnownedData() {
  return runUnscoped(async () => {
    const first = await User.findOne().sort({ createdAt: 1, _id: 1 }).lean();
    let assigned = 0;
    for (const M of MONEY_MODELS) {
      // Raw collection update: `owner` is immutable through Mongoose.
      if (first) assigned += (await M.collection.updateMany({ owner: { $exists: false } }, { $set: { owner: first._id } })).modifiedCount;
      await M.syncIndexes();
    }
    return { assigned, to: first ? first.email || first.phone : null };
  });
}

/**
 * Cards belong to every month from the first one they appear in. Cards added before that rule
 * can be missing from later months that were already set up – this adds their bill there.
 * Earlier months are never touched. Safe to run on every start: it does nothing once complete.
 */
export function fillCardBills() {
  return runUnscoped(async () => {
    let added = 0;
    for (const card of await Card.find({ closedOn: '' }).lean()) {
      const first = await BillItem.findOne({ card: card._id }).sort({ ym: 1 }).select('ym').lean();
      if (!first) continue;
      const [later, have] = await Promise.all([
        Month.distinct('ym', { owner: card.owner, ym: { $gt: first.ym } }),
        BillItem.distinct('ym', { card: card._id }),
      ]);
      for (const ym of later.filter((m) => !have.includes(m))) {
        await runAsOwner(card.owner, async () => BillItem.create({
          ym, name: `${card.name} credit card`, category: 'cc', status: 'unpaid', card: card._id, sortOrder: await nextSortOrder(BillItem, ym),
        }));
        added++;
      }
    }
    return added;
  });
}
