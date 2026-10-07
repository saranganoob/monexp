// Things that live across months: cards, card EMIs, installment plans, people.
import { Router } from 'express';
import { Month, BillItem, Card, CardEmi, Plan, Person, PeopleEntry, SuddenSpend, NETWORKS, RELATIONS } from '../models/index.js';
import { withUndo } from '../services/undo.js';
import { loadSetup, computeMonths, nextSortOrder } from '../services/monthService.js';
import { installmentAt } from '../services/compute.js';
import * as N from '../services/normalize.js';
import { badRequest, conflict, notFound } from '../lib/http.js';
import { toAmount, toText, toYm, toId, toEnum, toInt, toOptionalId } from '../lib/validate.js';
import { addMonths, currentYm, todayIso, ymToIndex } from '../lib/ym.js';

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
  const addToYm = req.body?.addToYm ? toYm(req.body.addToYm, 'addToYm') : null;
  res.status(201).json(await withUndo({ yms: addToYm ? [addToYm] : [], global: ['Card'] }, async () => {
    const card = await Card.create({ ...fields, sortOrder: ((await Card.findOne().sort({ sortOrder: -1 }).lean())?.sortOrder ?? 0) + 1 });
    if (addToYm && (await Month.exists({ ym: addToYm }))) {
      await BillItem.create({
        ym: addToYm, name: `${card.name} credit card`, category: 'cc', status: 'unpaid', card: card._id,
        sortOrder: await nextSortOrder(BillItem, addToYm),
      });
    }
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

// ---------------- card EMIs ----------------

async function emiFields(b, { partial }) {
  const out = {};
  if (!partial || b.cardId !== undefined) {
    out.card = toId(b.cardId, 'card');
    if (!(await Card.exists({ _id: out.card }))) throw notFound('Card not found.');
  }
  if (!partial || b.item !== undefined) out.item = toText(b.item, 'What was bought', { required: true });
  if (!partial || b.forWho !== undefined) out.forWho = toEnum(b.forWho ?? 'me', ['me', 'friend'], 'forWho');
  if (!partial || b.personId !== undefined) out.person = toOptionalId(b.personId, 'person');
  if (!partial || b.monthly !== undefined) out.monthly = toAmount(b.monthly, 'EMI per month');
  if (!partial || b.totalMonths !== undefined) out.totalMonths = toInt(b.totalMonths, 'Total months', { min: 1, max: 600 });
  if (b.startYm !== undefined) out.startYm = toYm(b.startYm, 'startYm');
  return out;
}

router.get('/emis', async (_req, res) => {
  res.json((await loadSetup()).emis);
});

// POST /api/emis { cardId, item, forWho, personId?, monthly, totalMonths, startYm }
//   or instead of startYm: { atYm, alreadyPaid } – "Already paid before Oct"
router.post('/emis', async (req, res) => {
  const b = req.body || {};
  const fields = await emiFields(b, { partial: false });
  if (!fields.startYm) {
    const atYm = toYm(b.atYm, 'atYm');
    const alreadyPaid = toInt(b.alreadyPaid ?? 0, 'Already paid', { min: 0 });
    if (alreadyPaid >= fields.totalMonths) throw badRequest('Already-paid installments must be fewer than the total.');
    fields.startYm = addMonths(atYm, -alreadyPaid);
  }
  if (fields.forWho === 'friend') {
    if (!fields.person) throw badRequest('Choose who this EMI is for, or add them as a new person.');
    if (!(await Person.exists({ _id: fields.person }))) throw notFound('Person not found.');
  } else {
    fields.person = null;
  }
  const card = await Card.findById(fields.card).lean();
  res.status(201).json(await withUndo({ global: ['CardEmi'] }, async () => N.normEmi((await CardEmi.create(fields)).toObject()),
    `${fields.item} EMI added to ${card.name}`));
});

router.patch('/emis/:id', async (req, res) => {
  const emi = await findOr404(CardEmi, req.params.id, 'EMI');
  const set = await emiFields(req.body || {}, { partial: true });
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');
  res.json(await withUndo({ global: ['CardEmi'] }, async () => {
    emi.set(set);
    if (emi.forWho === 'friend' && !emi.person) throw badRequest('A friend’s EMI needs a person.');
    await emi.save();
    return N.normEmi(emi.toObject());
  }, `${emi.item} EMI updated`));
});

router.delete('/emis/:id', async (req, res) => {
  const emi = await findOr404(CardEmi, req.params.id, 'EMI');
  res.json(await withUndo({ global: ['CardEmi'] }, () => CardEmi.deleteOne({ _id: emi._id }).then(() => ({})), `${emi.item} EMI removed`));
});

// ---------------- installment plans ----------------

function planFields(b, { partial }) {
  const out = {};
  if (!partial || b.name !== undefined) out.name = toText(b.name, 'Name', { required: true });
  if (b.kind !== undefined) out.kind = toText(b.kind, 'Kind');
  if (b.source !== undefined) out.source = toText(b.source, 'Description');
  if (!partial || b.direction !== undefined) out.direction = toEnum(b.direction ?? 'out', ['out', 'in'], 'direction');
  if (b.personId !== undefined) out.person = toOptionalId(b.personId, 'person');
  if (!partial || b.monthly !== undefined) out.monthly = toAmount(b.monthly, 'Per month');
  if (!partial || b.totalInstallments !== undefined) out.totalInstallments = toInt(b.totalInstallments, 'Total installments', { min: 1, max: 600 });
  if (!partial || b.startYm !== undefined) out.startYm = toYm(b.startYm, 'startYm');
  return out;
}

router.get('/plans', async (_req, res) => {
  res.json((await loadSetup()).plans);
});

router.post('/plans', async (req, res) => {
  const fields = planFields(req.body || {}, { partial: false });
  res.status(201).json(await withUndo({ global: ['Plan'] }, async () => N.normPlan((await Plan.create(fields)).toObject()), `${fields.name} plan added`));
});

router.patch('/plans/:id', async (req, res) => {
  const plan = await findOr404(Plan, req.params.id, 'Plan');
  const set = planFields(req.body || {}, { partial: true });
  if (!Object.keys(set).length) throw badRequest('Nothing to change.');
  res.json(await withUndo({ global: ['Plan'] }, async () => {
    plan.set(set);
    await plan.save();
    return N.normPlan(plan.toObject());
  }, `${plan.name} plan updated`));
});

router.delete('/plans/:id', async (req, res) => {
  const plan = await findOr404(Plan, req.params.id, 'Plan');
  const used = await Promise.all([BillItem.exists({ plan: plan._id }), PeopleEntry.exists({ plan: plan._id })]);
  if (used.some(Boolean)) throw conflict('Bills or people entries still use this plan, so deleting it would break their “X of Y” counts.');
  res.json(await withUndo({ global: ['Plan'] }, () => Plan.deleteOne({ _id: plan._id }).then(() => ({})), `${plan.name} plan deleted`));
});

// ---------------- people ----------------

const matchesPerson = (p, r) => r.personId === p.id
  || (!r.personId && r.name.split('·')[0].trim().toLowerCase() === p.name.toLowerCase());

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
  const at = req.query.at ? toYm(req.query.at, 'at') : currentYm();
  const setup = await loadSetup();
  const all = await computeMonths(null, setup);
  const now = all.find((c) => c.ym === at);
  const I = ymToIndex(at);

  res.json(setup.people.map((p) => {
    const owed = now ? now.receivables.filter((r) => r.status === 'pending' && matchesPerson(p, r)).reduce((s, r) => s + r.amount, 0) : 0;
    const iOwe = now ? now.payables.filter((r) => r.status === 'pending' && matchesPerson(p, r)).reduce((s, r) => s + r.amount, 0) : 0;
    const running = setup.emis.filter((e) => e.personId === p.id && ymToIndex(e.startYm) + e.totalMonths - 1 >= I);
    const leftToRecover = running.reduce((s, e) => {
      const at2 = installmentAt(e.startYm, e.totalMonths, at);
      let left = e.totalMonths - Math.max(at2.n - 1, 0);
      if (at2.n >= 1 && now?.receivables.some((r) => r.emiId === e.id && r.status === 'done')) left -= 1;
      return s + (e.monthly || 0) * left;
    }, 0);
    const receivedSoFar = all.reduce((s, c) => s + c.receivables.filter((r) => r.status === 'done' && matchesPerson(p, r)).reduce((t, r) => t + r.amount, 0), 0);
    return { ...p, owed, iOwe, runningEmis: running.length, leftToRecover, receivedSoFar };
  }));
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
  // Past entries keep their text (e.g. "Mohan · trip advance"); they just stop linking to the person.
  const yms = await PeopleEntry.distinct('ym', { person: person._id });
  res.json(await withUndo({ yms, global: ['Person'] }, async () => {
    await PeopleEntry.updateMany({ person: person._id }, { person: null });
    await Person.deleteOne({ _id: person._id });
    return {};
  }, `${person.name} removed from People`));
});

export default router;
