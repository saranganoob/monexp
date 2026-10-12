// One-off upgrade from the single-user version: data saved before accounts were separated
// has no owner, so it is given to the first account ever created (the original owner).
// Also replaces the old "one month per database" unique index with "one month per user".
// Safe to run on every start – it does nothing once everything has an owner.
import { User, MONEY_MODELS } from '../models/index.js';
import { runUnscoped } from '../lib/owner.js';

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
