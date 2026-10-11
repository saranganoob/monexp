// Per-person figures for the People list (and the AI assistant).
import { loadSetup, computeMonths } from './monthService.js';
import { installmentAt } from './compute.js';
import { ymToIndex } from '../lib/ym.js';

/** An entry belongs to a person by link, or by name ("Mohan · trip advance") when it isn't linked. */
export const matchesPerson = (p, r) => r.personId === p.id
  || (!r.personId && r.name.split('·')[0].trim().toLowerCase() === p.name.toLowerCase());

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);

/** Everyone, with what they owe / are owed in month `at`, running EMIs, and everything received so far. */
export async function peopleStats(at) {
  const setup = await loadSetup();
  const all = await computeMonths(null, setup);
  const now = all.find((c) => c.ym === at);
  const I = ymToIndex(at);

  return setup.people.map((p) => {
    const owed = now ? sum(now.receivables.filter((r) => r.status === 'pending' && matchesPerson(p, r))) : 0;
    const iOwe = now ? sum(now.payables.filter((r) => r.status === 'pending' && matchesPerson(p, r))) : 0;
    const running = setup.emis.filter((e) => e.personId === p.id && ymToIndex(e.startYm) + e.totalMonths - 1 >= I);
    const leftToRecover = running.reduce((s, e) => {
      const at2 = installmentAt(e.startYm, e.totalMonths, at);
      let left = e.totalMonths - Math.max(at2.n - 1, 0);
      if (at2.n >= 1 && now?.receivables.some((r) => r.emiId === e.id && r.status === 'done')) left -= 1;
      return s + (e.monthly || 0) * left;
    }, 0);
    const receivedSoFar = all.reduce((s, c) => s + sum(c.receivables.filter((r) => r.status === 'done' && matchesPerson(p, r))), 0);
    return { ...p, owed, iOwe, runningEmis: running.length, leftToRecover, receivedSoFar };
  });
}
