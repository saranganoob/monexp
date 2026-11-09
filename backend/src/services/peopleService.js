// Per-person figures for the People list (and the AI assistant).
import { loadSetup, computeMonths } from './monthService.js';
import { emiPlan } from './compute.js';
import { instAt, leftFrom } from '../lib/installments.js';
import { ymToIndex } from '../lib/ym.js';

/** An entry belongs to a person by link, or by name ("Vinod · trip advance") when it isn't linked. */
export const matchesPerson = (p, r) => r.personId === p.id
  || (!r.personId && r.name.split('·')[0].trim().toLowerCase() === p.name.toLowerCase());

/** Still to come on pending entries (parts already settled taken off). */
const left = (rows) => rows.reduce((s, r) => s + (r.status === 'pending' ? r.left ?? r.amount : 0), 0);
/** Settled so far: whole entries once done, plus parts of the rest (carried-over ones included). */
const settled = (rows) => rows.reduce((s, r) => s + (r.status === 'done' ? r.amount : r.paid || 0), 0);

/** Everyone, with what they owe / are owed in month `at`, running EMIs, and everything received so far. */
export async function peopleStats(at) {
  const setup = await loadSetup();
  const all = await computeMonths(null, setup);
  const now = all.find((c) => c.ym === at);
  const I = ymToIndex(at);

  return setup.people.map((p) => {
    const owed = now ? left(now.receivables.filter((r) => matchesPerson(p, r))) : 0;
    const iOwe = now ? left(now.payables.filter((r) => matchesPerson(p, r))) : 0;
    // EMIs I pay for them that still have payments to come (monthly or yearly, card or bank).
    const running = setup.emis.filter((e) => e.personId === p.id && leftFrom(emiPlan(e), I) > 0);
    const leftToRecover = running.reduce((s, e) => {
      const plan = emiPlan(e);
      // Ongoing EMIs have no end, so only this month's payment counts as still to recover.
      let left = e.totalMonths == null ? (instAt(plan, I).due ? 1 : 0) : leftFrom(plan, I);
      if (instAt(plan, I).due && now?.receivables.some((r) => r.emiId === e.id && r.status === 'done')) left -= 1;
      return s + (e.monthly || 0) * left;
    }, 0);
    const receivedSoFar = all.reduce((s, c) => s + settled(c.receivables.filter((r) => matchesPerson(p, r))), 0);
    return { ...p, owed, iOwe, runningEmis: running.length, leftToRecover, receivedSoFar };
  });
}
