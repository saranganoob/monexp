import mongoose from 'mongoose';
import { Month, BillItem, Card, CardEmi, Plan, Person, PeopleEntry, SuddenSpend, Undo } from '../src/models/index.js';
import * as data from './seed-data.js';

export const DATA_MODELS = [Month, BillItem, Card, CardEmi, Plan, Person, PeopleEntry, SuddenSpend, Undo];

export async function hasData() {
  return Boolean(await Month.exists({}));
}

// Wipes all money data (never users) and loads the sample months.
export async function seedSampleData() {
  for (const M of DATA_MODELS) await M.deleteMany({});

  const ids = new Map();
  const oid = (key) => {
    if (key == null) return null;
    if (!ids.has(key)) ids.set(key, new mongoose.Types.ObjectId());
    return ids.get(key);
  };

  await Card.insertMany(data.cards.map(({ id, ...c }) => ({ _id: oid(id), ...c })));
  await Person.insertMany(data.people.map(({ id, ...p }) => ({ _id: oid(id), ...p })));
  await Plan.insertMany(data.plans.map(({ id, personId, ...p }) => ({ _id: oid(id), person: oid(personId), ...p })));
  await CardEmi.insertMany(data.emis.map(({ id, cardId, personId, ...e }) => ({ _id: oid(id), card: oid(cardId), person: oid(personId), ...e })));

  for (const m of data.months) {
    await Month.create({
      ym: m.ym, budget: m.budget, createdHow: 'seed',
      cardSpends: Object.fromEntries(Object.entries(m.cardSpends).map(([k, v]) => [String(oid(k)), v])),
      emiOverrides: (m.emiOverrides || []).map(({ emiId, ...o }) => ({ emi: oid(emiId), ...o })),
    });
    await BillItem.insertMany(m.bills.map(({ cardId, planId, ...b }, i) => ({ ym: m.ym, card: oid(cardId), plan: oid(planId), sortOrder: i + 1, ...b })));
    await PeopleEntry.insertMany(m.entries.map(({ personId, planId, ...r }, i) => ({ ym: m.ym, person: oid(personId), plan: oid(planId), sortOrder: i + 1, ...r })));
    await SuddenSpend.insertMany(m.sudden.map(({ cardId, ...s }) => ({ ym: m.ym, card: oid(cardId), ...s })));
  }
  return { months: data.months.length };
}
