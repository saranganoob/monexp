// Changing or removing a single bill, people entry or sudden spend.
import { Router } from 'express';
import { BillItem, Card, CardSpend, Month, PeopleEntry, SuddenSpend } from '../models/index.js';
import { withUndo } from '../services/undo.js';
import { CATEGORY_KEYS } from '../lib/categories.js';
import { badRequest, notFound } from '../lib/http.js';
import { toAmount, toText, toId, toEnum, toInt } from '../lib/validate.js';
import { ymLabel } from '../lib/ym.js';

const router = Router();

async function findOr404(Model, id, what) {
  const doc = await Model.findById(toId(id, what)).lean();
  if (!doc) throw notFound(`${what} not found.`);
  return doc;
}

// ---- bills ----

router.patch('/bills/:id', async (req, res) => {
  const bill = await findOr404(BillItem, req.params.id, 'Bill');
  const b = req.body || {};
  const set = {};
  if (b.name !== undefined) set.name = toText(b.name, 'Name', { required: true });
  if (b.category !== undefined) set.category = toEnum(b.category, CATEGORY_KEYS, 'category');
  if (b.amount !== undefined) {
    if (bill.card) throw badRequest('A card bill is worked out from its spends and EMIs – edit it on the card instead.');
    set.amount = toAmount(b.amount, 'Amount');
  }
  if (b.dueDay !== undefined) set.dueDay = b.dueDay === null || b.dueDay === '' ? null : toInt(b.dueDay, 'Due day', { min: 1, max: 31 });
  if (b.note !== undefined) set.note = toText(b.note, 'Note', { max: 500 });
  if (b.status !== undefined) {
    set.status = toEnum(b.status, ['paid', 'unpaid', 'skipped'], 'status');
    if (set.status === 'skipped' && b.note === undefined) set.note = 'Cancelled for this month';
  }
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');

  const name = set.name || bill.name;
  const message = set.status === 'paid' ? `${name} marked paid`
    : set.status === 'unpaid' ? (bill.status === 'skipped' ? `${name} resumed` : `${name} marked unpaid`)
      : set.status === 'skipped' ? `${name} skipped for this month`
        : `${name} updated`;
  res.json(await withUndo({ yms: [bill.ym] }, () => BillItem.updateOne({ _id: bill._id }, { $set: set }).then(() => ({})), message));
});

router.delete('/bills/:id', async (req, res) => {
  const bill = await findOr404(BillItem, req.params.id, 'Bill');
  res.json(await withUndo({ yms: [bill.ym] }, () => BillItem.deleteOne({ _id: bill._id }).then(() => ({})),
    `${bill.name} removed from ${ymLabel(bill.ym)}`));
});

// ---- people entries ----

router.patch('/people-entries/:id', async (req, res) => {
  const entry = await findOr404(PeopleEntry, req.params.id, 'Entry');
  if (entry.status === 'moved') throw badRequest(`This was carried over to ${ymLabel(entry.movedTo)} – change it there.`);
  const b = req.body || {};
  const set = {};
  if (b.name !== undefined) set.name = toText(b.name, 'Who · what for', { required: true });
  if (b.amount !== undefined) {
    set.amount = toAmount(b.amount, 'Amount');
    if (!set.amount) throw badRequest('Enter an amount above ₹0 — or delete the entry if nothing is due.');
  }
  if (b.status !== undefined) set.status = toEnum(b.status, ['pending', 'done'], 'status');
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');

  const name = set.name || entry.name;
  const message = set.status === 'done' ? `${name} ${entry.direction === 'in' ? 'marked received' : 'marked paid back'}`
    : set.status === 'pending' ? `${name} set back to pending`
      : `${name} updated for ${ymLabel(entry.ym)}`;
  res.json(await withUndo({ yms: [entry.ym] }, () => PeopleEntry.updateOne({ _id: entry._id }, { $set: set }).then(() => ({})), message));
});

router.delete('/people-entries/:id', async (req, res) => {
  const entry = await findOr404(PeopleEntry, req.params.id, 'Entry');
  if (entry.status === 'moved') throw badRequest(`This was carried over to ${ymLabel(entry.movedTo)} – remove it there.`);
  const yms = entry.carriedFrom ? [entry.ym, entry.carriedFrom] : [entry.ym];
  res.json(await withUndo({ yms }, async () => {
    await PeopleEntry.deleteOne({ _id: entry._id });
    // Removing a carried-over copy puts the original back to pending in its month.
    if (entry.origin) await PeopleEntry.updateOne({ _id: entry.origin }, { status: 'pending', movedTo: null });
    return {};
  }, `${entry.name} removed from ${ymLabel(entry.ym)}${entry.carriedFrom ? ` — back to pending in ${ymLabel(entry.carriedFrom)}` : ''}`));
});

// ---- sudden spends ----

router.delete('/sudden/:id', async (req, res) => {
  const s = await findOr404(SuddenSpend, req.params.id, 'Sudden spend');
  res.json(await withUndo({ yms: [s.ym] }, () => SuddenSpend.deleteOne({ _id: s._id }).then(() => ({})), `${s.name} removed`));
});

// ---- itemised card spends ----

// Removing an item also takes its amount off the card's "my spends".
router.delete('/card-spends/:id', async (req, res) => {
  const s = await findOr404(CardSpend, req.params.id, 'Spend');
  const card = await Card.findById(s.card).lean();
  res.json(await withUndo({ yms: [s.ym] }, async () => {
    await CardSpend.deleteOne({ _id: s._id });
    const month = await Month.findOne({ ym: s.ym });
    if (month) {
      const key = String(s.card);
      month.cardSpends.set(key, Math.max(0, (month.cardSpends.get(key) || 0) - s.amount));
      await month.save();
    }
    return {};
  }, `${s.name} removed from ${card?.name ?? 'the card'}`));
});

export default router;
