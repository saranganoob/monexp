// Turns Mongo documents (lean) into plain objects with string ids for compute.js and the API.
const sid = (v) => (v == null ? null : String(v));

export const normCard = (c) => ({ id: sid(c._id), name: c.name, last4: c.last4 || '', network: c.network || '', closedOn: c.closedOn || '', sortOrder: c.sortOrder || 0 });

export const normEmi = (e) => ({
  id: sid(e._id), cardId: sid(e.card), item: e.item, forWho: e.forWho, personId: sid(e.person),
  monthly: e.monthly || 0, freq: e.freq || 'monthly', totalMonths: e.totalMonths ?? null, ongoing: e.totalMonths == null, startYm: e.startYm,
  price: e.price ?? null, fee: e.fee || 0, chargesBy: e.chargesBy || 'friend', boughtOn: e.boughtOn || '',
});

export const normPlan = (p) => ({
  id: sid(p._id), name: p.name, kind: p.kind || '', source: p.source || '', direction: p.direction, category: p.category || 'fam',
  personId: sid(p.person), monthly: p.monthly || 0, totalInstallments: p.totalInstallments ?? null, ongoing: p.totalInstallments == null, startYm: p.startYm,
});

export const normPerson = (p) => ({ id: sid(p._id), name: p.name, relation: p.relation || '', phone: p.phone || '', upi: p.upi || '', note: p.note || '' });

export const normMonth = (m) => ({
  id: sid(m._id), ym: m.ym, budget: m.budget || 0, createdHow: m.createdHow,
  cardSpends: m.cardSpends instanceof Map ? Object.fromEntries(m.cardSpends) : { ...(m.cardSpends || {}) },
  emiOverrides: (m.emiOverrides || []).map((o) => ({ emiId: sid(o.emi), amount: o.amount ?? null, received: o.received || 'pending', paid: o.paid || 'unpaid' })),
});

export const normBill = (b) => ({
  id: sid(b._id), ym: b.ym, name: b.name, category: b.category, amount: b.amount || 0, status: b.status,
  dueDay: b.dueDay ?? null, note: b.note || '', cardId: sid(b.card), planId: sid(b.plan), sortOrder: b.sortOrder || 0,
});

const entryBase = (r, amount) => ({
  id: sid(r._id), ym: r.ym, direction: r.direction, personId: sid(r.person), name: r.name, amount,
  status: r.status, planId: sid(r.plan), note: r.note || '', carriedFrom: r.carriedFrom || null, movedTo: r.movedTo || null,
  originId: sid(r.origin), sortOrder: r.sortOrder || 0,
});
/** Money between people: `paid` = received / paid back so far (all of it once done), `left` = still to come. */
export const normEntry = (r) => {
  const amount = r.amount || 0;
  const parts = (r.parts || []).map((p) => ({ id: sid(p._id), amount: p.amount || 0, date: p.date }));
  const paid = r.status === 'done' ? amount : Math.min(amount, parts.reduce((s, p) => s + p.amount, 0));
  return { ...entryBase(r, amount), parts, paid, left: r.status === 'pending' ? amount - paid : 0 };
};

export const normSudden = (s) => ({
  id: sid(s._id), ym: s.ym, name: s.name, amount: s.amount || 0, mode: s.mode, cardId: sid(s.card),
  date: s.date, dateUnknown: !!s.dateUnknown, note: s.note || '',
});

export const normCardSpend = (s) => ({
  id: sid(s._id), ym: s.ym, cardId: sid(s.card), name: s.name, amount: s.amount || 0, date: s.date,
  personId: sid(s.person), entryId: sid(s.entry), emiId: sid(s.emi),
});
