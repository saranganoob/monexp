// "Bought for a friend": something a friend bought on my credit card (e.g. a phone, for the card discount),
// which they pay me back. One call creates the linked records:
//   One-time – a purchase on the card (in that month's card bill) + "they owe me" in People (can be paid back in parts).
//   EMI      – a friend's EMI on the card (card bill each month, "X of Y" + Mark received in People),
//              plus the one-time fee (processing + GST) as a purchase on the first bill.
// Extra charges (EMI interest, fee): the friend pays them (default), or I absorb them – then the friend repays
// only the price, and the rest counts as my own spending.
import { Router } from 'express';
import { Card, CardEmi, CardSpend, Month, PeopleEntry, Person } from '../models/index.js';
import { withUndo } from '../services/undo.js';
import { ensureMonth, nextSortOrder } from '../services/monthService.js';
import { badRequest, notFound } from '../lib/http.js';
import { toAmount, toEnum, toInt, toOptionalId, toText, toYm } from '../lib/validate.js';
import { todayInIndia, ymLabel } from '../lib/ym.js';
import { inr } from '../lib/format.js';

const router = Router();

// POST /api/friend-purchases
//   { personId | newPersonName, item, cardId, price, date, type: "once" | "emi",
//     monthly?, months?, startYm?,   (EMI only: the card's EMI amount incl. interest, number of EMIs, first EMI month)
//     fee?, chargesBy?: "friend" | "me" }
router.post('/friend-purchases', async (req, res) => {
  const b = req.body || {};
  const type = toEnum(b.type ?? 'once', ['once', 'emi'], 'type');
  const item = toText(b.item, 'What was bought', { required: true, max: 80 });
  const price = toAmount(b.price, 'Price');
  if (!price) throw badRequest('Add the price, above ₹0.');
  const fee = b.fee == null || b.fee === '' ? 0 : toAmount(b.fee, 'Extra charges');
  const chargesBy = toEnum(b.chargesBy ?? 'friend', ['friend', 'me'], 'who pays the charges');
  const date = String(b.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayInIndia()) throw badRequest('Pick the date it was bought – today or earlier.');
  const ym = date.slice(0, 7);

  const cardId = toOptionalId(b.cardId, 'card');
  if (!cardId) throw badRequest('Choose the card it was charged to.');
  const card = await Card.findById(cardId).lean();
  if (!card) throw notFound('Card not found.');

  let emi = null;
  if (type === 'emi') {
    const monthly = toAmount(b.monthly, 'EMI amount');
    if (!monthly) throw badRequest('Add the EMI amount per month (from the card’s EMI details).');
    const months = toInt(b.months, 'Number of EMIs', { min: 2, max: 120 });
    if (monthly * months < price) throw badRequest(`${months} × ${inr(monthly)} is less than the price ${inr(price)} – check the EMI amount.`);
    emi = { monthly, months, startYm: b.startYm ? toYm(b.startYm, 'First EMI month') : ym };
  }

  const personId = toOptionalId(b.personId, 'person');
  const newPersonName = toText(b.newPersonName, 'Friend’s name', { max: 60 });
  if (!personId && !newPersonName) throw badRequest('Choose the friend it was bought for.');

  const scope = { yms: [ym, ...(emi ? [emi.startYm] : [])], global: ['Person', ...(emi ? ['CardEmi'] : [])] };
  const out = await withUndo(scope, async () => {
    const person = personId
      ? await Person.findById(personId).lean()
      : (await Person.findOne({ name: newPersonName }).collation({ locale: 'en', strength: 2 }).lean())
        || (await Person.create({ name: newPersonName, relation: 'Friend' })).toObject();
    if (!person) throw notFound('Person not found.');
    const who = person.name;

    if (!emi) {
      // One-time: the card bill gets price + charges; the friend owes the price (+ charges if they pay them).
      await ensureMonth(ym);
      const owed = price + (chargesBy === 'friend' ? fee : 0);
      const spend = await CardSpend.create({ ym, card: card._id, name: `${item} · for ${who}`, amount: price + fee, date, person: person._id });
      await Month.updateOne({ ym }, { $inc: { [`cardSpends.${card._id}`]: price + fee } });
      const entry = await PeopleEntry.create({
        ym, direction: 'in', person: person._id, name: `${who} · ${item}`, amount: owed, status: 'pending', cardSpend: spend._id,
        note: `Bought on ${card.name} · ${date}` + (fee ? (chargesBy === 'friend' ? ` · incl. ${inr(fee)} charges` : ` · ${inr(fee)} charges on me`) : ''),
        sortOrder: await nextSortOrder(PeopleEntry, ym),
      });
      await CardSpend.updateOne({ _id: spend._id }, { entry: entry._id });
      return { who, message: `${item} for ${who}: ${inr(price + fee)} on ${card.name} · ${who} owes you ${inr(owed)}` };
    }

    // EMI on my card for the friend: the existing friend-EMI tracking does the monthly part.
    const doc = await CardEmi.create({
      card: card._id, item, forWho: 'friend', person: person._id, monthly: emi.monthly, freq: 'monthly',
      totalMonths: emi.months, startYm: emi.startYm, price, fee, chargesBy, boughtOn: date,
    });
    if (fee) {
      // The one-time fee lands on the first EMI bill; the friend owes it too unless I absorb it.
      await ensureMonth(emi.startYm);
      const spend = await CardSpend.create({
        ym: emi.startYm, card: card._id, name: `${item} EMI fee · for ${who}`, amount: fee,
        date: emi.startYm === ym ? date : `${emi.startYm}-01`, person: person._id, emi: doc._id,
      });
      await Month.updateOne({ ym: emi.startYm }, { $inc: { [`cardSpends.${card._id}`]: fee } });
      if (chargesBy === 'friend') {
        const entry = await PeopleEntry.create({
          ym: emi.startYm, direction: 'in', person: person._id, name: `${who} · ${item} EMI fee`, amount: fee, status: 'pending',
          cardSpend: spend._id, emi: doc._id, note: `Processing fee + GST on ${card.name}`, sortOrder: await nextSortOrder(PeopleEntry, emi.startYm),
        });
        await CardSpend.updateOne({ _id: spend._id }, { entry: entry._id });
      }
    }
    const repay = chargesBy === 'me' ? Math.floor(price / emi.months) : emi.monthly;
    return {
      who,
      message: `${item} for ${who}: ${emi.months} EMIs of ${inr(emi.monthly)} on ${card.name} from ${ymLabel(emi.startYm, { short: true })}`
        + ` · ${who} pays you ${inr(repay)} a month`,
    };
  }, (r) => r.message);
  res.status(201).json(out);
});

export default router;
