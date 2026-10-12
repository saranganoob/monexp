// Whose data a piece of code is working on. Each signed-in request runs "as" its user
// (see middleware/auth.js), and the owner plugin on the money models reads it from here,
// so every query and every new record is limited to that user automatically.
import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

const store = new AsyncLocalStorage();

const toId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

/** Runs `fn` with all money-data queries limited to user `ownerId`. */
export const runAsOwner = (ownerId, fn) => store.run({ owner: toId(ownerId) }, fn);

/** Runs `fn` with no owner filter – only for one-off maintenance (startup migration). */
export const runUnscoped = (fn) => store.run({ unscoped: true }, fn);

export const isUnscoped = () => Boolean(store.getStore()?.unscoped);

/** The current user's id. Throws when there is none, so data can never leak between users by accident. */
export function currentOwner() {
  const owner = store.getStore()?.owner;
  if (!owner) throw new Error('No signed-in user for this database call (wrap it in runAsOwner).');
  return owner;
}
