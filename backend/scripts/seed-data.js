// Sample data: Jan–Oct 2026 from sample-data.xlsx, as used in the design prototype.
// Ids here are short keys ("c1", "pp3"); seed.js swaps them for real MongoDB ids.
// Phase 3 replaces this with a proper import of the sheet.

export const cards = [
  { id: 'c1', name: 'Flipkart Axis', sortOrder: 1 },
  { id: 'c2', name: 'Amazon Pay ICICI', sortOrder: 2 },
  { id: 'c3', name: 'HDFC Swiggy', sortOrder: 3 },
  { id: 'c4', name: 'Super money', closedOn: '2026-02-28', sortOrder: 4 },
];

export const people = [
  { id: 'pp1', name: 'Sathish Rajan', relation: 'Friend' },
  { id: 'pp2', name: 'Aravind', relation: 'Friend' },
  { id: 'pp3', name: 'Madhan' },
  { id: 'pp4', name: 'Mohan' },
  { id: 'pp5', name: 'Balaji' },
  { id: 'pp6', name: 'Siva', relation: 'Roommate' },
  { id: 'pp7', name: 'Mani' },
  { id: 'pp8', name: 'Nishanth' },
  { id: 'pp9', name: 'Grandpa', relation: 'Family' },
];

export const plans = [
  { id: 'p2', name: 'Dad', kind: 'Monthly support', source: 'Sent every month', direction: 'out', category: 'fam', monthly: 10000, totalInstallments: 40, startYm: '2024-01' },
  { id: 'p4', name: 'Gold chit', kind: 'Savings (chit)', source: '₹9,000 a month for 11 months', direction: 'out', category: 'inv', monthly: 9000, totalInstallments: 11, startYm: '2025-08' },
  { id: 'p3', name: 'Madhan · gym', kind: 'Paying you back', source: '₹3,500 in 7 parts', direction: 'in', category: 'fam', personId: 'pp3', monthly: 500, totalInstallments: 7, startYm: '2026-06' },
];

export const emis = [
  { id: 'e1', cardId: 'c1', item: 'Apple Watch', forWho: 'me', monthly: 0, totalMonths: 9, startYm: '2026-01' },
  { id: 'e2', cardId: 'c1', item: 'Purchase', forWho: 'friend', personId: 'pp1', monthly: 1255, totalMonths: 6, startYm: '2025-10' },
  { id: 'e3', cardId: 'c2', item: 'Purchase', forWho: 'friend', personId: 'pp2', monthly: 11062, totalMonths: 6, startYm: '2025-08' },
];

// ---- builders for bill rows ----
const bill = (name, category, amount, status = 'paid', extra = {}) => ({ name, category, amount, status, ...extra });
const SIP_NAMES = [
  ['ICICI Prudential Nifty 50 Index Fund', 3000, 1],
  ['Motilal Oswal Gold and Silver ETFs FoF', 2000, 1],
  ['Motilal Oswal Flexi Cap Fund', 1500, 1],
  ['Tata Small Cap Fund', 1500, 5],
  ['Tata Nifty Midcap 150 Index Fund', 2000, 1],
];
const sips = (paid) => SIP_NAMES.map(([n, a, due]) => (paid
  ? bill(n, 'inv', a, 'paid', { dueDay: due })
  : bill(n, 'inv', 0, 'skipped', { note: 'Cancelled for this month' })));
const sipAll = () => [bill('SIP (all funds)', 'inv', 0, 'skipped', { note: 'Cancelled for this month' })];
const subs = (ytDue, st = ['paid', 'paid', 'paid']) => [
  bill('Netflix', 'sub', 499, st[0], { dueDay: 5 }),
  bill('YouTube', 'sub', 300, st[1], { dueDay: ytDue }),
  bill('Apple iCloud', 'sub', 219, st[2], { dueDay: 21 }),
];
const rent = (a = 4000) => bill('House rent + maintenance', 'house', a);
const card = (cardId, extra = {}) => bill('card bill', 'cc', 0, 'paid', { cardId, ...extra });
const dad = (a = 10000) => bill('Dad', 'fam', a, 'paid', { planId: 'p2' });
const chit = () => bill('Gold chit', 'inv', 9000, 'paid', { planId: 'p4' });
const mom = (a = 4000, note = '') => bill('Mom', 'fam', a, 'paid', { note });
const fam = (n, a, extra) => bill(n, 'fam', a, 'paid', extra);

const owesMe = (name, amount, status = 'done', extra = {}) => ({ direction: 'in', name, amount, status, ...extra });
const sudden = (name, amount, mode, date, extra = {}) => ({ name, amount, mode, date, ...extra });

export const months = [
  {
    ym: '2026-01', budget: 66000, cardSpends: { c1: 3660, c2: 0, c4: 62502 },
    emiOverrides: [{ emiId: 'e2', received: 'done' }, { emiId: 'e3', received: 'done' }],
    bills: [...sips(true), ...subs(14), rent(4600), fam('Office trip', 3000, { note: '₹7,000 − ₹4,000 · ₹4K paid on 5 Jan' }), card('c1'), card('c2'), card('c4'), dad(), chit()],
    entries: [owesMe('Poorvika · refund', 4500)],
    sudden: [sudden('Car dent and service', 50085, 'Axis Bank', '2026-01-15', { dateUnknown: true, note: 'General service ₹13,835 · left side painting & denting ₹24,957 · left mirror set & front panel ₹11,293' })],
  },
  {
    ym: '2026-02', budget: 66000, cardSpends: { c1: 3600, c2: 3921, c4: 3920 },
    emiOverrides: [{ emiId: 'e2', amount: 1673, received: 'done' }],
    bills: [...sips(true), ...subs(14), rent(), card('c1'), card('c2'), card('c4'), fam('Akheel · dress', 800), fam('Gokul · kadan', 3000), fam('Dhiwakar · bike insurance', 2164), mom(), dad(), chit()],
    entries: [],
    sudden: [sudden('Biriyani treat at office for my birthday', 7080, 'Axis', '2026-02-17')],
  },
  {
    ym: '2026-03', budget: 65000, cardSpends: { c1: 3600, c2: 0, c3: 1781, c4: 14592 },
    emiOverrides: [{ emiId: 'e2', received: 'done' }],
    bills: [...sips(true), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), card('c4', { note: 'Card closed on 28 Feb 2026' }), fam('Sharan', 2500), mom(), dad(), chit()],
    entries: [
      owesMe('Siva · room mate', 5000, 'done', { personId: 'pp6' }),
      owesMe('Grandpa · CCTV + mobile recharge', 1000, 'done', { personId: 'pp9' }),
      owesMe('Madhan · concert money', 500, 'done', { personId: 'pp3', note: '₹1,623 total · ₹1,123 left' }),
    ],
    sudden: [sudden('Bike service', 3567, 'Paid by Gokul', '2026-03-28')],
  },
  {
    ym: '2026-04', budget: 66000, cardSpends: { c1: 21633, c2: 11335, c3: 1197 },
    bills: [...sips(true), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), fam('Sarath', 3500), mom(), dad(), chit()],
    entries: [owesMe('Mohan', 2443, 'done', { personId: 'pp4' }), owesMe('Madhan · concert money', 500, 'done', { personId: 'pp3', note: '₹623 left' })],
    sudden: [sudden('Car battery', 5000, 'Flipkart Axis credit card', '2026-04-18', { cardId: 'c1' })],
  },
  {
    ym: '2026-05', budget: 66000, cardSpends: { c1: 8715, c2: 23693, c3: 0 },
    bills: [...sips(false), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), fam('Kodai trip', 5000), fam('Akheel', 1500), mom(), dad(), chit()],
    entries: [
      owesMe('Balaji', 1000, 'done', { personId: 'pp5' }),
      owesMe('Mohan', 1196, 'done', { personId: 'pp4' }),
      owesMe('Madhan · concert money', 623, 'done', { personId: 'pp3', note: 'Fully settled' }),
    ],
    sudden: [],
  },
  {
    ym: '2026-06', budget: 66000, cardSpends: { c1: 5971, c2: 17104, c3: 0 },
    bills: [...sips(false), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), fam('Gokul', 2000), fam('Sharan', 3000), fam('Mohan · advance', 4000), fam('David', 2200), mom(), dad(), chit()],
    entries: [
      owesMe('CCTV', 800),
      owesMe('Balaji · room advance', 5000, 'done', { personId: 'pp5' }),
      owesMe('Madhan · gym (₹3,500 total)', 500, 'done', { personId: 'pp3', planId: 'p3' }),
    ],
    sudden: [sudden('GRT gold chain', 35600, 'Amazon Pay ICICI credit card', '2026-06-12', { cardId: 'c2' })],
  },
  {
    ym: '2026-07', budget: 66000, cardSpends: { c1: 9000, c2: 43185, c3: 0 },
    bills: [...sips(false), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), fam('Sharan', 2000), mom(), dad()],
    entries: [
      owesMe('Mani · phone balance', 6000, 'done', { personId: 'pp7' }),
      owesMe('Grandpa · recharge', 200, 'done', { personId: 'pp9' }),
      owesMe('Madhan · gym (₹3,500 total)', 500, 'done', { personId: 'pp3', planId: 'p3' }),
    ],
    sudden: [],
  },
  {
    ym: '2026-08', budget: 66000, cardSpends: { c1: 13807, c2: 12880, c3: 843 },
    bills: [...sips(false), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), fam('Sharan', 3000), fam('Trip amount', 2285), fam('Gym balance', 10000), mom(), dad()],
    entries: [
      owesMe('Grandpa · recharge', 200, 'done', { personId: 'pp9' }),
      owesMe('Balaji · phone balance', 1000, 'done', { personId: 'pp5' }),
      owesMe('Madhan · gym (₹3,500 total)', 500, 'done', { personId: 'pp3', planId: 'p3' }),
    ],
    sudden: [sudden('Ear problem · Kamatchi Hospital', 2065, 'Axis', '2026-08-07')],
  },
  {
    ym: '2026-09', budget: 66000, cardSpends: { c1: 8007, c2: 18464, c3: 300 },
    bills: [...sipAll(), ...subs(18), rent(), card('c1'), card('c2'), card('c3'), mom(), dad(9500)],
    entries: [
      owesMe('Grandpa · recharge', 200, 'done', { personId: 'pp9' }),
      owesMe('Madhan · gym (₹3,500 total)', 500, 'done', { personId: 'pp3', planId: 'p3' }),
    ],
    sudden: [],
  },
  {
    ym: '2026-10', budget: 66000, cardSpends: { c1: 5219, c2: 26755, c3: 2474 },
    bills: [...sipAll(), ...subs(18, ['unpaid', 'unpaid', 'unpaid']), rent(), card('c1'), card('c2'), card('c3'), fam('Trip', 6000), mom(0, '₹4,000 went to mobile recharge instead'), dad()],
    entries: [
      owesMe('Grandpa · recharge', 200, 'pending', { personId: 'pp9' }),
      owesMe('Mohan · trip advance', 2000, 'pending', { personId: 'pp4' }),
      owesMe('Nishanth · shoe balance', 2819, 'done', { personId: 'pp8' }),
      owesMe('Madhan · gym (₹3,500 total)', 500, 'pending', { personId: 'pp3', planId: 'p3' }),
    ],
    sudden: [],
  },
];

// The same data in the plain shape compute.js takes (used by the tests).
export function plainSetup() {
  const fill = (rows, defaults) => rows.map((r) => ({ ...defaults, ...r }));
  return {
    cards: fill(cards, { last4: '', network: '', closedOn: '' }),
    people: fill(people, { relation: '', phone: '', upi: '', note: '' }),
    plans: fill(plans, { personId: null }),
    emis: fill(emis, { personId: null }),
  };
}

export function plainMonth(ym) {
  const m = months.find((x) => x.ym === ym);
  let n = 0;
  const id = (p) => `${p}${++n}`;
  return {
    ym,
    month: { ym, budget: m.budget, cardSpends: m.cardSpends, emiOverrides: (m.emiOverrides || []).map((o) => ({ amount: null, received: 'pending', ...o })) },
    bills: m.bills.map((b, i) => ({ id: id('b'), ym, dueDay: null, note: '', cardId: null, planId: null, sortOrder: i, ...b })),
    entries: m.entries.map((r, i) => ({ id: id('r'), ym, personId: null, planId: null, note: '', sortOrder: i, ...r })),
    sudden: m.sudden.map((s) => ({ id: id('s'), ym, cardId: null, dateUnknown: false, note: '', ...s })),
  };
}
