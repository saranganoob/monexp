// The AI-written "how's this month going" note on Overview. Cached per month.
import crypto from 'node:crypto';
import { AiSummary } from '../../models/index.js';
import { computeMonths } from '../monthService.js';
import { addMonths } from '../../lib/ym.js';
import { HttpError } from '../../lib/http.js';
import { aiEnabled, baseParams, getClient } from './client.js';
import { SUMMARY_SYSTEM } from './prompts.js';
import { monthView } from './tools.js';
import { config } from '../../config.js';

/** The figures the summary is written from – also hashed to tell when a summary is out of date. */
async function figuresFor(ym) {
  const prevYm = addMonths(ym, -1);
  const [current, previous] = await Promise.all([computeMonths([ym]), computeMonths([prevYm])]).then(([a, b]) => [a[0], b[0]]);
  if (!current) throw new HttpError(404, 'This month isn’t set up yet.');
  const cur = monthView(current);
  const figures = { thisMonth: cur };
  if (previous) {
    const prev = monthView(previous);
    const cardBills = (m) => m.creditCards.reduce((s, c) => s + c.bill, 0);
    figures.previousMonth = { month: prev.month, budget: prev.budget, totals: prev.totals, cardBills: cardBills(prev) };
    // Differences worked out here, so the model never does the arithmetic.
    figures.changeFromPreviousMonth = {
      budget: cur.budget - prev.budget,
      myShareOfBills: cur.totals.myShareOfBills - prev.totals.myShareOfBills,
      cardBills: cardBills(cur) - cardBills(prev),
      suddenSpends: cur.totals.suddenSpendsNotOnCards - prev.totals.suddenSpendsNotOnCards,
      balanceLeft: cur.totals.balanceLeft - prev.totals.balanceLeft,
    };
  }
  return figures;
}

const hashOf = (figures) => crypto.createHash('sha256').update(JSON.stringify(figures)).digest('hex');

export async function getSummary(ym) {
  const saved = await AiSummary.findOne({ ym }).lean();
  if (!saved) return { enabled: aiEnabled(), summary: null, stale: false };
  let stale = false;
  try {
    stale = hashOf(await figuresFor(ym)) !== saved.dataHash;
  } catch {
    stale = true;
  }
  return { enabled: aiEnabled(), summary: { text: saved.text, createdAt: saved.updatedAt, model: saved.model }, stale };
}

export async function generateSummary(ym) {
  const figures = await figuresFor(ym);
  const response = await getClient().beta.messages.create({
    ...baseParams(),
    max_tokens: 16000,
    output_config: { effort: 'low' },
    system: SUMMARY_SYSTEM,
    messages: [{ role: 'user', content: `Figures (JSON):\n${JSON.stringify(figures)}` }],
  });
  if (response.stop_reason === 'refusal') throw new HttpError(502, 'Claude declined to write this summary. Try again later.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!text) throw new HttpError(502, 'Claude returned an empty summary. Try again.');

  const saved = await AiSummary.findOneAndUpdate(
    { ym },
    { text, model: response.model ?? config.anthropicModel, dataHash: hashOf(figures) },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return { enabled: true, summary: { text: saved.text, createdAt: saved.updatedAt, model: saved.model }, stale: false };
}
