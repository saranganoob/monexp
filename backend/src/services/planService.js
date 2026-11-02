// Keeps each month's rows in line with its installment plans.
// An "out" plan (Dad, gold chit) appears as a bill in Need to pay; an "in" plan
// (Arun paying back the gym money) appears as money owed to you in People.
import { Month, BillItem, PeopleEntry, Person } from '../models/index.js';
import { installmentAt } from './compute.js';

const modelFor = (plan) => (plan.direction === 'in' ? PeopleEntry : BillItem);
// Rows that haven't been acted on yet – the only ones a plan change may touch.
const openStatus = (plan) => (plan.direction === 'in' ? 'pending' : 'unpaid');

async function personName(plan) {
  return plan.person ? (await Person.findById(plan.person).lean())?.name ?? '' : '';
}

/** "Arun · gym" – the person's name goes in front of "in" plans unless it's already there. */
export function planRowName(plan, who) {
  if (plan.direction !== 'in' || !who || plan.name.toLowerCase().startsWith(who.toLowerCase())) return plan.name;
  return `${who} · ${plan.name}`;
}

/** Adds this plan's row to month `ym`. */
export async function addPlanRow(plan, ym, who) {
  who ??= await personName(plan);
  const Model = modelFor(plan);
  const last = await Model.findOne({ ym }).sort({ sortOrder: -1 }).select('sortOrder').lean();
  const sortOrder = (last?.sortOrder ?? 0) + 1;
  if (plan.direction === 'in') {
    return PeopleEntry.create({
      ym, direction: 'in', person: plan.person, name: planRowName(plan, who), amount: plan.monthly,
      status: 'pending', plan: plan._id, sortOrder,
    });
  }
  return BillItem.create({
    ym, name: plan.name, category: plan.category || 'fam', amount: plan.monthly, status: 'unpaid', plan: plan._id, sortOrder,
  });
}

/**
 * For every month that exists from `fromYm` on: adds the plan's row where the plan is
 * running and the row is missing, removes not-yet-paid rows where it isn't running, and
 * (optionally) refreshes the name / amount / group of not-yet-paid rows.
 * Earlier months are left alone, so history doesn't change.
 */
export async function syncPlanRows(plan, fromYm, { name = false, amount = false, category = false } = {}) {
  const Model = modelFor(plan);
  const open = openStatus(plan);
  const who = await personName(plan);
  const months = await Month.find({ ym: { $gte: fromYm } }).select('ym').lean();

  for (const { ym } of months) {
    const { active } = installmentAt(plan.startYm, plan.totalInstallments, ym);
    if (!active) {
      await Model.deleteMany({ ym, plan: plan._id, status: open });
      continue;
    }
    if (!(await Model.exists({ ym, plan: plan._id }))) {
      await addPlanRow(plan, ym, who);
      continue;
    }
    const set = {};
    if (name) set.name = planRowName(plan, who);
    if (amount) set.amount = plan.monthly;
    if (category && plan.direction === 'out') set.category = plan.category;
    if (Object.keys(set).length) await Model.updateMany({ ym, plan: plan._id, status: open }, { $set: set });
  }
}

/** Before deleting a plan: drop its unpaid rows from `fromYm` on, keep the rest as plain rows. */
export async function detachPlanRows(plan, fromYm) {
  const Model = modelFor(plan);
  await Model.deleteMany({ ym: { $gte: fromYm }, plan: plan._id, status: openStatus(plan) });
  await Model.updateMany({ plan: plan._id }, { $set: { plan: null } });
}

/** Months a plan change can touch – for the Undo snapshot. */
export async function planYms(plan, fromYm) {
  const Model = modelFor(plan);
  const [later, linked] = await Promise.all([
    Month.distinct('ym', { ym: { $gte: fromYm } }),
    Model.distinct('ym', { plan: plan._id }),
  ]);
  return [...new Set([...later, ...linked])];
}
