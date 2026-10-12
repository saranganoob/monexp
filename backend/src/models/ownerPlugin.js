import { Schema } from 'mongoose';
import { currentOwner, isUnscoped } from '../lib/owner.js';

const QUERY_OPS = [
  'find', 'findOne', 'countDocuments', 'distinct',
  'updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndReplace',
  'deleteOne', 'deleteMany', 'findOneAndDelete',
];

/**
 * Makes a model per-user: adds an `owner` field (filled from the signed-in user on create)
 * and limits every query to the signed-in user's documents.
 */
export function ownerPlugin(schema) {
  schema.add({
    owner: {
      type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true,
      default: () => (isUnscoped() ? undefined : currentOwner()),
    },
  });
  schema.pre(QUERY_OPS, function scopeToOwner() {
    if (!isUnscoped()) this.where({ owner: currentOwner() });
  });
}
