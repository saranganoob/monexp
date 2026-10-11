// "Undo" support: before a change we snapshot the records it can touch, and the
// Undo button restores that snapshot. Snapshots expire after an hour.
import { Month, BillItem, PeopleEntry, SuddenSpend, CardSpend, Card, CardEmi, Plan, Person, Undo } from '../models/index.js';
import { notFound } from '../lib/http.js';

const MONTH_SCOPED = { Month, BillItem, PeopleEntry, SuddenSpend, CardSpend };
const GLOBAL = { Card, CardEmi, Plan, Person };

// scope: { yms: ['2026-10'], global: ['CardEmi'] }
async function snapshot({ yms = [], global = [] }) {
  const parts = [];
  if (yms.length) {
    for (const [model, M] of Object.entries(MONTH_SCOPED)) {
      parts.push({ model, yms, docs: await M.find({ ym: { $in: yms } }).lean() });
    }
  }
  for (const model of global) {
    parts.push({ model, yms: null, docs: await GLOBAL[model].find().lean() });
  }
  return parts;
}

// Runs `fn`, then stores the "before" snapshot. Returns fn's result plus an undo token.
export async function withUndo(scope, fn, message) {
  const parts = await snapshot(scope);
  const result = await fn();
  const label = typeof message === 'function' ? message(result) : message;
  const undo = await Undo.create({ label, parts });
  // Only the latest change can be undone: restoring an older snapshot would also
  // silently wipe out everything changed after it.
  await Undo.deleteMany({ _id: { $ne: undo._id } });
  return { ...(result && typeof result === 'object' && !Array.isArray(result) ? result : { result }), message: label, undoToken: String(undo._id) };
}

export async function restoreUndo(token) {
  const undo = await Undo.findById(token).lean();
  if (!undo) throw notFound('This change can no longer be undone.');
  for (const part of undo.parts) {
    const M = MONTH_SCOPED[part.model] || GLOBAL[part.model];
    const filter = part.yms ? { ym: { $in: part.yms } } : {};
    await M.deleteMany(filter);
    if (part.docs.length) await M.collection.insertMany(part.docs);
  }
  await Undo.deleteOne({ _id: undo._id });
  return { message: `Undone: ${undo.label}` };
}
