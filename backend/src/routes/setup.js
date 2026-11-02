// Things that live across months: cards, card EMIs, installment plans, people.
import { Router } from 'express';
import { Month, BillItem, Card, CardEmi, Plan, Person, PeopleEntry, SuddenSpend, NETWORKS, RELATIONS } from '../models/index.js';
import { withUndo } from '../services/undo.js';
import { addCardBills, loadSetup } from '../services/monthService.js';
import { syncPlanRows, detachPlanRows, planYms } from '../services/planService.js';
import { peopleStats } from '../services/peopleService.js';
import { CATEGORY_KEYS } from '../lib/categories.js';
import { inr } from '../lib/format.js';
import * as N from '../services/normalize.js';
import { badRequest, conflict, notFound } from '../lib/http.js';
import { toAmount, toText, toYm, toId, toEnum, toInt, toOptionalId } from '../lib/validate.js';
import { addMonths, currentYm, todayIso } from '../lib/ym.js';

const router = Router();

async function findOr404(Model, id, what) {
  const doc = await Model.findById(toId(id, what));
  if (!doc) throw notFound(`${what} not found.`);
  return doc;
}

// ---------------- cards ----------------

function cardFields(b, { partial }) {
  const out = {};
  if (!partial || b.name !== undefined) out.name = toText(b.name, 'Card name', { required: true, max: 60 });
  if (!partial || b.last4 !== undefined) {
    out.last4 = toText(b.last4, 'Last 4 digits');
    if (!/^\d{4}$/.test(out.last4)) throw badRequest('Enter exactly the last 4 digits.');
  }
  if (!partial || b.network !== undefined) out.network = toEnum(b.network, NETWORKS.filter(Boolean), 'Network');
  return out;
}

router.get('/cards', async (_req, res) => {
  res.json((await loadSetup()).cards);
});

// POST /api/cards { name, last4, network, addToYm? } – addToYm adds the card's bill to that month
router.post('/cards', async (req, res) => {
  const fields = cardFields(req.body || {}, { partial: false });
  // The card's bill is added to the month being viewed and every later month (earlier months keep their history).
  const addToYm = req.body?.addToYm ? toYm(req.body.addToYm, 'addToYm') : null;
  const yms = addToYm ? await Month.distinct('ym', { ym: { $gte: addToYm } }) : [];
  res.status(201).json(await withUndo({ yms, global: ['Card'] }, async () => {
    const card = await Card.create({ ...fields, sortOrder: ((await Card.findOne().sort({ sortOrder: -1 }).lean())?.sortOrder ?? 0) + 1 });
    for (const ym of yms) await addCardBills(ym);
    return N.normCard(card.toObject());
  }, `${fields.name} added`));
});

// PATCH /api/cards/:id { name?, last4?, network?, closed?: boolean }
router.patch('/cards/:id', async (req, res) => {
  const card = await findOr404(Card, req.params.id, 'Card');
  const b = req.body || {};
  const set = cardFields(b, { partial: true });
  if (b.closed !== undefined) set.closedOn = b.closed ? (card.closedOn || todayIso()) : '';
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');
  const label = b.closed === true ? `${card.name} marked closed` : b.closed === false ? `${card.name} reopened` : `${set.name || card.name} updated`;
  res.json(await withUndo({ global: ['Card'] }, async () => {
    card.set(set);
    await card.save();
    return N.normCard(card.toObject());
  }, label));
});

router.delete('/cards/:id', async (req, res) => {
  const card = await findOr404(Card, req.params.id, 'Card');
  const used = await Promise.all([BillItem.exists({ card: card._id }), CardEmi.exists({ card: card._id }), SuddenSpend.exists({ card: card._id })]);
  if (used.some(Boolean)) throw conflict('This card appears in your bills or EMIs, so deleting it would break that history. Mark it closed instead.');
  res.json(await withUndo({ global: ['Card'] }, () => Card.deleteOne({ _id: card._id }).then(() => ({})), `${card.name} deleted`));
});

// ---------------- EMIs & installments ----------------
// Paid from a card (added to that card's bill) or from the bank / cash (cardId null: its own row
// in Need to pay). Monthly or yearly; `totalMonths` is the number of payments.

async function emiFields(b, { partial }) {
  const out = {};
  if (!partial || b.cardId !== undefined) {
    out.card = toOptionalId(b.cardId, 'card'); // null / '' = bank or cash
    if (out.card && !(await Card.exists({ _id: out.card }))) throw notFound('Card not found.');
  }
  if (!partial || b.item !== undefined) out.item = toText(b.item, 'What is it', { required: true });
  if (!partial || b.forWho !== undefined) out.forWho = toEnum(b.forWho ?? 'me', ['me', 'friend'], 'forWho');
  if (!partial || b.personId !== undefined) out.person = toOptionalId(b.personId, 'person');
  if (!partial || b.monthly !== undefined) out.monthly = toAmount(b.monthly, 'Amount per payment');
  if (!partial || b.freq !== undefined) out.freq = toEnum(b.freq ?? 'monthly', ['monthly', 'yearly'], 'How often');
  // ongoing: true = no end date (rent, support…); otherwise the number of payments.
  if (b.ongoing === true) out.totalMonths = null;
  else if (!partial || b.totalMonths !== undefined) out.totalMonths = toInt(b.totalMonths, 'Number of payments', { min: 1, max: 600 });
  if (b.startYm !== undefined) out.startYm = toYm(b.startYm, 'startYm');
  return out;
}

router.get('/emis', async (_req, res) => {
  res.json((await loadSetup()).emis);
});

// POST /api/emis { cardId|null, item, forWho, personId?, monthly, freq, totalMonths | ongoing: true, startYm }
//   or instead of startYm: { atYm, alreadyPaid } – "Already paid before Oct" (monthly)
router.post('/emis', async (req, res) => {
  const b = req.body || {};
  const fields = await emiFields(b, { partial: false });
  if (!fields.monthly) throw badRequest('Add the amount per payment.');
  if (!fields.startYm) {
    const atYm = toYm(b.atYm, 'atYm');
    const alreadyPaid = toInt(b.alreadyPaid ?? 0, 'Already paid', { min: 0 });
    if (fields.totalMonths != null && alreadyPaid >= fields.totalMonths) throw badRequest('Already-paid installments must be fewer than the total.');
    fields.startYm = addMonths(atYm, -alreadyPaid);
  }
  if (fields.forWho === 'friend') {
    if (!fields.person) throw badRequest('Choose who this EMI is for, or add them as a new person.');
    if (!(await Person.exists({ _id: fields.person }))) throw notFound('Person not found.');
  } else {
    fields.person = null;
  }
  const card = fields.card ? await Card.findById(fields.card).lean() : null;
  res.status(201).json(await withUndo({ global: ['CardEmi'] }, async () => N.normEmi((await CardEmi.create(fields)).toObject()),
    card ? `${fields.item} EMI added to ${card.name}` : `${fields.item} added (paid from bank / cash)`));
});

router.patch('/emis/:id', async (req, res) => {
  const emi = await findOr404(CardEmi, req.params.id, 'EMI');
  const set = await emiFields(req.body || {}, { partial: true });
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');
  res.json(await withUndo({ global: ['CardEmi'] }, async () => {
    emi.set(set);
    if (emi.forWho === 'me') emi.person = null;
    if (emi.forWho === 'friend' && !emi.person) throw badRequest('Choose who this EMI is for.');
    if (emi.forWho === 'friend' && !(await Person.exists({ _id: emi.person }))) throw notFound('Person not found.');
    await emi.save();
    return N.normEmi(emi.toObject());
  }, `${emi.item} EMI updated`));
});

router.delete('/emis/:id', async (req, res) => {
  const emi = await findOr404(CardEmi, req.params.id, 'EMI');
  res.json(await withUndo({ global: ['CardEmi'] }, () => CardEmi.deleteOne({ _id: emi._id }).then(() => ({})), `${emi.item} EMI removed`));
});

// ---------------- installment plans ----------------
// Changes apply from the month you're viewing (`atYm`) onwards; earlier months keep their history.

function planFields(b, { partial }) {
  const out = {};
  if (!partial || b.name !== undefined) out.name = toText(b.name, 'Name', { required: true, max: 80 });
  if (b.kind !== undefined) out.kind = toText(b.kind, 'Type label', { max: 40 });
  if (b.source !== undefined) out.source = toText(b.source, 'Description', { max: 120 });
  if (!partial) out.direction = toEnum(b.direction ?? 'out', ['out', 'in'], 'direction');
  if (b.category !== undefined) out.category = toEnum(b.category, CATEGORY_KEYS.filter((k) => k !== 'cc'), 'Group');
  if (b.personId !== undefined) out.person = toOptionalId(b.personId, 'person');
  if (!partial || b.monthly !== undefined) {
    out.monthly = toAmount(b.monthly, 'Per month');
    if (!out.monthly) throw badRequest('Add the amount per month.');
  }
  if (b.ongoing === true) out.totalInstallments = null; // no end date
  else if (!partial || b.totalInstallments !== undefined) out.totalInstallments = toInt(b.totalInstallments, 'Total months', { min: 1, max: 600 });
  if (b.startYm !== undefined) out.startYm = toYm(b.startYm, 'Start month');
  return out;
}

const atYmOf = (req) => toYm(req.body?.atYm ?? req.query.at ?? currentYm(), 'atYm');

router.get('/plans', async (_req, res) => {
  res.json((await loadSetup()).plans);
});

// POST /api/plans { name, direction, monthly, totalInstallments | ongoing: true, startYm | alreadyPaid, category?, personId?, kind?, source?, atYm }
router.post('/plans', async (req, res) => {
  const b = req.body || {};
  const atYm = atYmOf(req);
  const fields = planFields(b, { partial: false });
  if (!fields.startYm) {
    const alreadyPaid = toInt(b.alreadyPaid ?? 0, 'Already paid', { min: 0 });
    if (fields.totalInstallments != null && alreadyPaid >= fields.totalInstallments) throw badRequest('Already-paid months must be fewer than the total.');
    fields.startYm = addMonths(atYm, -alreadyPaid);
  }
  if (fields.direction === 'in') {
    if (!fields.person) throw badRequest('Choose who is paying you back.');
    if (!(await Person.exists({ _id: fields.person }))) throw notFound('Person not found.');
  }
  fields.kind ||= fields.direction === 'in' ? 'Paying you back' : 'Monthly payment';
  fields.source ||= fields.totalInstallments == null ? `${inr(fields.monthly)} a month, ongoing` : `${inr(fields.monthly)} a month for ${fields.totalInstallments} months`;

  const yms = await Month.distinct('ym', { ym: { $gte: atYm } });
  res.status(201).json(await withUndo({ yms, global: ['Plan'] }, async () => {
    const plan = await Plan.create(fields);
    await syncPlanRows(plan, atYm);
    return N.normPlan(plan.toObject());
  }, `${fields.name} plan added`));
});

router.patch('/plans/:id', async (req, res) => {
  const plan = await findOr404(Plan, req.params.id, 'Plan');
  const atYm = atYmOf(req);
  const set = planFields(req.body || {}, { partial: true });
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');
  if (plan.direction === 'in' && set.person === null) throw badRequest('Choose who is paying you back.');

  const changed = (k) => set[k] !== undefined && String(set[k]) !== String(plan[k]);
  const yms = await planYms(plan, atYm);
  res.json(await withUndo({ yms, global: ['Plan'] }, async () => {
    const opts = { name: changed('name') || changed('person'), amount: changed('monthly'), category: changed('category') };
    plan.set(set);
    await plan.save();
    await syncPlanRows(plan, atYm, opts);
    return N.normPlan(plan.toObject());
  }, `${plan.name} plan updated`));
});

// DELETE /api/plans/:id?at=2026-10 – unpaid rows from that month on go; paid history stays.
router.delete('/plans/:id', async (req, res) => {
  const plan = await findOr404(Plan, req.params.id, 'Plan');
  const atYm = atYmOf(req);
  const yms = await planYms(plan, atYm);
  res.json(await withUndo({ yms, global: ['Plan'] }, async () => {
    await detachPlanRows(plan, atYm);
    await Plan.deleteOne({ _id: plan._id });
    return {};
  }, `${plan.name} plan removed`));
});

// ---------------- people ----------------

async function personFields(b, { partial, excludeId }) {
  const out = {};
  if (!partial || b.name !== undefined) {
    out.name = toText(b.name, 'Name', { required: true, max: 80 });
    const clash = await Person.findOne({ name: out.name, _id: { $ne: excludeId } }).collation({ locale: 'en', strength: 2 }).lean();
    if (clash) throw conflict('Someone with this name is already in your list.');
  }
  if (b.relation !== undefined) out.relation = toEnum(b.relation, RELATIONS, 'Relationship');
  if (b.phone !== undefined) {
    out.phone = toText(b.phone, 'Phone').replace(/\D/g, '');
    if (out.phone && !/^[6-9]\d{9}$/.test(out.phone)) throw badRequest('Enter a 10-digit Indian mobile number, or leave it empty.');
  }
  if (b.upi !== undefined) {
    out.upi = toText(b.upi, 'UPI ID');
    if (out.upi && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(out.upi)) throw badRequest('A UPI ID looks like name@bank.');
  }
  if (b.note !== undefined) out.note = toText(b.note, 'Note');
  return out;
}

// GET /api/people?at=2026-10 – everyone, with what they owe / are owed in that month,
// running EMIs, and everything received from them so far.
router.get('/people', async (req, res) => {
  res.json(await peopleStats(req.query.at ? toYm(req.query.at, 'at') : currentYm()));
});

router.post('/people', async (req, res) => {
  const fields = await personFields(req.body || {}, { partial: false });
  res.status(201).json(await withUndo({ global: ['Person'] }, async () => N.normPerson((await Person.create(fields)).toObject()), `${fields.name} added to People`));
});

router.patch('/people/:id', async (req, res) => {
  const person = await findOr404(Person, req.params.id, 'Person');
  const set = await personFields(req.body || {}, { partial: true, excludeId: person._id });
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');
  res.json(await withUndo({ global: ['Person'] }, async () => {
    person.set(set);
    await person.save();
    return N.normPerson(person.toObject());
  }, `${person.name} updated`));
});

router.delete('/people/:id', async (req, res) => {
  const person = await findOr404(Person, req.params.id, 'Person');
  if (await CardEmi.exists({ person: person._id })) throw conflict(`${person.name} still has an EMI on your card. Remove that EMI first.`);
  if (await Plan.exists({ person: person._id })) throw conflict(`${person.name} is linked to an installment plan. Remove or change that plan first.`);
  // Past entries keep their text (e.g. "Vinod · trip advance"); they just stop linking to the person.
  const yms = await PeopleEntry.distinct('ym', { person: person._id });
  res.json(await withUndo({ yms, global: ['Person'] }, async () => {
    await PeopleEntry.updateMany({ person: person._id }, { person: null });
    await Person.deleteOne({ _id: person._id });
    return {};
  }, `${person.name} removed from People`));
});

export default router;
