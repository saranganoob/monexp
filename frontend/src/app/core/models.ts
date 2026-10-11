// Shapes of the JSON the backend sends (see backend/src/services/compute.js).

export type BillStatus = 'paid' | 'unpaid' | 'skipped';
export type EntryStatus = 'pending' | 'done' | 'moved';
export type CategoryKey = 'cc' | 'fam' | 'house' | 'sub' | 'inv';
export interface Inst { n: number; total: number; }

export interface Bill {
  id: string; ym: string; name: string; category: CategoryKey; amount: number; status: BillStatus;
  dueDay: number | null; note: string; cardId: string | null; planId: string | null; sortOrder: number; inst: Inst | null;
}

export interface EmiView {
  id: string; cardId: string; item: string; forWho: 'me' | 'friend'; personId: string | null; personName: string;
  monthly: number; amount: number; n: number; total: number; startYm: string; endYm: string; received: 'pending' | 'done';
}

export interface CardView {
  id: string; name: string; network: string; last4: string; closedOn: string;
  spends: number; myEmis: number; friendEmis: number; total: number; emis: EmiView[];
  items: CardSpendItem[]; itemised: number; notItemised: number;
  billId: string | null; billStatus: BillStatus | null;
}

export interface CardSpendItem { id: string; cardId: string; name: string; amount: number; date: string; }

export interface Entry {
  id: string; direction: 'in' | 'out'; personId: string | null; name: string; amount: number; status: EntryStatus;
  planId: string | null; note: string; carriedFrom: string | null; movedTo: string | null;
  inst: Inst | null; auto: string | null; emiId?: string;
}

export interface Sudden {
  id: string; ym: string; name: string; amount: number; mode: string; cardId: string | null;
  date: string; dateUnknown: boolean; note: string;
}

export interface Totals {
  toPay: number; paid: number; unpaid: number; paidCount: number; unpaidCount: number; skippedCount: number;
  paidPct: number; friendEmi: number; ownPay: number; sudden: number; balance: number; balanceInclPeople: number;
  recvTotal: number; recvPending: number; recvDone: number; payTotal: number; payPending: number; payDone: number;
}

export interface MonthData {
  exists: true; ym: string; budget: number; createdHow: string; totals: Totals;
  categories: { key: CategoryKey; label: string; total: number }[];
  bills: Bill[]; cards: CardView[]; receivables: Entry[]; payables: Entry[]; suddenSpends: Sudden[];
}

export interface MissingMonth { exists: false; ym: string; rolloverFrom: string | null; carryCandidates: Entry[]; }
export type MonthView = MonthData | MissingMonth;

export interface Card { id: string; name: string; last4: string; network: string; closedOn: string; }
export interface CardEmi { id: string; cardId: string; item: string; forWho: 'me' | 'friend'; personId: string | null; monthly: number; totalMonths: number; startYm: string; }
export interface Plan {
  id: string; name: string; kind: string; source: string; direction: 'out' | 'in'; category: CategoryKey;
  personId: string | null; monthly: number; totalInstallments: number; startYm: string;
}
export interface Person { id: string; name: string; relation: string; phone: string; upi: string; note: string; }
export interface PersonStats extends Person { owed: number; iOwe: number; runningEmis: number; leftToRecover: number; receivedSoFar: number; }

export interface Installment {
  id: string; type: 'emi' | 'plan'; name: string; kind: string; source: string; friend: boolean; incoming: boolean;
  monthly: number; startYm: string; total: number; n: number; endYm: string; monthsLeft: number; amountLeft: number;
}

export interface YearView {
  year: number; trackedCount: number; budget: number; spent: number; leftOver: number;
  months: ({ ym: string; exists: false } | { ym: string; exists: true; budget: number; spent: number; sudden: number })[];
  categories: { key: string; label: string; total: number }[];
}

export interface Account { email: string; phone: string; }
export interface ChangeResult { message: string; undoToken: string; id?: string; }
