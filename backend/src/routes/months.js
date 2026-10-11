import { Router } from 'express';
import { Month, BillItem, Card, CardEmi, Person, PeopleEntry, SuddenSpend } from '../models/index.js';
import { getMonthView, createMonth, ensureMonth, findPrevMonth, nextSortOrder, computeMonths } from '../services/monthService.js';
import { withUndo } from '../services/undo.js';
import { CATEGORY_KEYS } from '../lib/categories.js';
import { badRequest, notFound } from '../lib/http.js';
import { toAmount, toText, toYm, toId, toEnum, toInt, toOptionalId } from '../lib/validate.js';
import { ymLabel, lastDayOfMonth } from '../lib/ym.js';
import { inr } from '../lib/format.js';

const router = Router();

router.param('ym', (req, _res, next, ym) => {
  try {
    req.ym = toYm(ym);
    next();
  } catch (err) {
    next(err);
  }
});

async function requireMonth(ym) {
  const month = await Month.findOne({ ym });
  if (!month) throw notFound(`${ymLabel(ym)} isn’t set up yet.`);
  return month;
}

// GET /api/months?year=2026 – which months exist
router.get('/', async (req, res) => {
  const filter = req.query.year ? { ym: { $regex: `^${toInt(req.query.year, 'year', { min: 2000, max: 2100 })}-` } } : {};
  const months = await Month.find(filter).sort({ ym: 1 }).select('ym budget createdHow').lean();
  res.json(months.map((m) => ({ ym: m.ym, budget: m.budget, createdHow: m.createdHow })));
});

router.get('/:ym', async (req, res) => {
  res.json(await getMonthView(req.ym));
});

// POST /api/months/:ym  { mode: "rollover" | "blank", carryIds: [...] }
router.post('/:ym', async (req, res) => {
  const mode = toEnum(req.body?.mode, ['rollover', 'blank'], 'mode');
  const carryIds = Array.isArray(req.body?.carryIds) ? req.body.carryIds.map((id) => toId(id, 'carryIds')) : [];
  const prev = await findPrevMonth(req.ym);
  const yms = prev ? [req.ym, prev.ym] : [req.ym];
  const out = await withUndo({ yms }, async () => {
    await createMonth(req.ym, { mode, carryIds });
    return {};
  }, mode === 'blank' ? `Started a blank ${ymLabel(req.ym)}` : `${ymLabel(req.ym)} rolled over from ${ymLabel(prev?.ym ?? req.ym)}`);
  res.status(201).json({ ...out, month: await getMonthView(req.ym) });
});

router.patch('/:ym', async (req, res) => {
  const budget = toAmount(req.body?.budget, 'Budget');
  const out = await withUndo({ yms: [req.ym] }, async () => {
    const month = await requireMonth(req.ym);
    month.budget = budget;
    await month.save();
    return {};
  }, `Budget for ${ymLabel(req.ym)} set to ${inr(budget)}`);
  res.json(out);
});

// PUT /api/months/:ym/cards/:cardId/bill  { total } or { spends } or { add }
// "Edit bill" takes the statement total; we store the part that's my own spends.
// { add: 321 } puts a new spend on top of what's already there (100 → 421).
router.put('/:ym/cards/:cardId/bill', async (req, res) => {
  const cardId = toId(req.params.cardId, 'card');
  const card = await Card.findById(cardId).lean();
  if (!card) throw notFound('Card not found.');
  const [computed] = await computeMonths([req.ym]);
  if (!computed) throw notFound(`${ymLabel(req.ym)} isn’t set up yet.`);
  const cv = computed.cards.find((c) => c.id === cardId);
  const emiTotal = cv.myEmis + cv.friendEmis;

  let spends;
  let message = null;
  if (req.body?.add !== undefined) {
    const add = toAmount(req.body.add, 'Amount to add');
    if (!add) throw badRequest('Enter an amount above ₹0 to add.');
    spends = cv.spends + add;
    message = `${inr(add)} added to ${card.name} spends · now ${inr(spends)}`;
  } else if (req.body?.total !== undefined) {
    const total = toAmount(req.body.total, 'Bill total');
    if (total < emiTotal) throw badRequest(`The bill can’t be less than the EMIs on this card (${inr(emiTotal)}). Check the amount, or edit the EMIs.`);
    spends = total - emiTotal;
  } else {
    spends = toAmount(req.body?.spends, 'My spends');
  }
  const out = await withUndo({ yms: [req.ym] }, async () => {
    await Month.updateOne({ ym: req.ym }, { $set: { [`cardSpends.${cardId}`]: spends } });
    return {};
  }, message ?? `${card.name} bill for ${ymLabel(req.ym)} set to ${inr(spends + emiTotal)}`);
  res.json(out);
});

// PATCH /api/months/:ym/emis/:emiId  { amount?: number|null, received?: "pending"|"done" }
router.patch('/:ym/emis/:emiId', async (req, res) => {
  const emiId = toId(req.params.emiId, 'EMI');
  const emi = await CardEmi.findById(emiId).populate('person', 'name').lean();
  if (!emi) throw notFound('EMI not found.');
  const change = {};
  if (req.body?.amount !== undefined) change.amount = req.body.amount === null ? null : toAmount(req.body.amount, 'EMI amount');
  if (req.body?.received !== undefined) change.received = toEnum(req.body.received, ['pending', 'done'], 'received');
  if (!Object.keys(change).length) throw badRequest('Nothing to change.');

  const who = emi.person?.name || 'Friend';
  const label = change.received === 'done' ? `${who} · ${emi.item} EMI marked received`
    : change.received === 'pending' ? `${who} · ${emi.item} EMI set back to pending`
      : `${emi.item} EMI for ${ymLabel(req.ym)} updated`;
  const out = await withUndo({ yms: [req.ym] }, async () => {
    const month = await requireMonth(req.ym);
    let o = month.emiOverrides.find((x) => String(x.emi) === emiId);
    if (!o) {
      month.emiOverrides.push({ emi: emiId });
      o = month.emiOverrides[month.emiOverrides.length - 1];
    }
    Object.assign(o, change);
    await month.save();
    return {};
  }, label);
  res.json(out);
});

// POST /api/months/:ym/bills  – sets the month up first if needed
router.post('/:ym/bills', async (req, res) => {
  const b = req.body || {};
  const bill = {
    ym: req.ym,
    name: toText(b.name, 'Name', { required: true }),
    category: toEnum(b.category ?? 'fam', CATEGORY_KEYS, 'category'),
    amount: toAmount(b.amount, 'Amount'),
    status: toEnum(b.status ?? 'unpaid', ['paid', 'unpaid', 'skipped'], 'status'),
    dueDay: b.dueDay === undefined || b.dueDay === null || b.dueDay === '' ? null : toInt(b.dueDay, 'Due day', { min: 1, max: 31 }),
    note: toText(b.note, 'Note'),
  };
  const out = await withUndo({ yms: [req.ym] }, async () => {
    await ensureMonth(req.ym);
    const doc = await BillItem.create({ ...bill, sortOrder: await nextSortOrder(BillItem, req.ym) });
    return { id: String(doc._id) };
  }, `${bill.name} added to ${ymLabel(req.ym)} bills`);
  res.status(201).json(out);
});

// POST /api/months/:ym/people-entries
//   { direction: "in"|"out", personId? | newPersonName?, reason?, amount }  (Add expense dialog)
//   { direction, name: "Ravi · movie tickets", amount }                    (quick add on People)
router.post('/:ym/people-entries', async (req, res) => {
  const b = req.body || {};
  const direction = toEnum(b.direction, ['in', 'out'], 'direction');
  const amount = toAmount(b.amount, 'Amount');
  if (!amount) throw badRequest('Add an amount above ₹0.');
  const personId = toOptionalId(b.personId, 'person');
  const newPersonName = toText(b.newPersonName, 'New person’s name');
  const reason = toText(b.reason, 'Reason');
  let name = toText(b.name, 'Name');

  const out = await withUndo({ yms: [req.ym], global: newPersonName ? ['Person'] : [] }, async () => {
    let person = null;
    if (personId) {
      person = await Person.findById(personId).lean();
      if (!person) throw notFound('Person not found.');
    } else if (newPersonName) {
      person = (await Person.findOne({ name: newPersonName }).collation({ locale: 'en', strength: 2 }).lean())
        || (await Person.create({ name: newPersonName })).toObject();
    } else if (name) {
      // Free text like "Ravi · movie tickets": link to Ravi if he's in People.
      const first = name.split('·')[0].trim();
      person = await Person.findOne({ name: first }).collation({ locale: 'en', strength: 2 }).lean();
    } else {
      throw badRequest('Choose a person.');
    }
    if (person && !name) name = person.name + (reason ? ` · ${reason}` : '');

    await ensureMonth(req.ym);
    const doc = await PeopleEntry.create({
      ym: req.ym, direction, person: person?._id ?? null, name, amount, status: 'pending',
      sortOrder: await nextSortOrder(PeopleEntry, req.ym),
    });
    return { id: String(doc._id), name };
  }, (r) => (direction === 'in' ? `${r.name} owes you ${inr(amount)}` : `${r.name}: you owe ${inr(amount)}`));
  res.status(201).json(out);
});

// POST /api/months/:ym/sudden  { name, amount, mode: "UPI"|"Cash"|"Bank account"|"card:<id>", date, note? }
router.post('/:ym/sudden', async (req, res) => {
  const b = req.body || {};
  const name = toText(b.name, 'What was it', { required: true });
  const amount = toAmount(b.amount, 'Amount');
  if (!amount) throw badRequest('Add an amount above ₹0.');
  const date = toText(b.date, 'Date', { required: true });
  const first = `${req.ym}-01`;
  const last = `${req.ym}-${String(lastDayOfMonth(req.ym)).padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < first || date > last) throw badRequest(`Pick a date inside ${ymLabel(req.ym)}.`);

  const modeIn = toText(b.mode || 'UPI', 'Paid with');
  let mode = modeIn;
  let card = null;
  if (modeIn.startsWith('card:')) {
    const c = await Card.findById(toId(modeIn.slice(5), 'card')).lean();
    if (!c) throw notFound('Card not found.');
    card = c._id;
    mode = `${c.name} credit card`;
  } else {
    toEnum(modeIn, ['UPI', 'Cash', 'Bank account'], 'Paid with');
  }

  const out = await withUndo({ yms: [req.ym] }, async () => {
    await ensureMonth(req.ym);
    const doc = await SuddenSpend.create({ ym: req.ym, name, amount, mode, card, date, note: toText(b.note, 'Note', { max: 500 }) });
    return { id: String(doc._id) };
  }, `${inr(amount)} sudden spend added to ${ymLabel(req.ym)}`);
  res.status(201).json(out);
});

export default router;
