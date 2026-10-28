// Shapes of the JSON the backend sends (see backend/src/services/compute.js).

export type BillStatus = 'paid' | 'unpaid' | 'skipped';
export type EntryStatus = 'pending' | 'done' | 'moved';
/** emi / owe are filled by the app (bank-cash EMIs, money I owe) and can't be picked for a bill. */
export type CategoryKey = 'cc' | 'fam' | 'house' | 'sub' | 'inv' | 'emi' | 'owe';
/** Where an installment stands. total null + ongoing = no end date (rent, support…). */
export interface Inst { n: number; total: number | null; left?: number | null; ongoing?: boolean; }
export type Freq = 'monthly' | 'yearly';

/**
 * A Need-to-pay row. kind: 'bill' = a normal bill; 'emi' = an EMI paid from the bank / cash
 * (status kept per month on the EMI); 'owe' = money I owe someone (the People entry is the record).
 */
export interface Bill {
  id: string; ym: string; name: string; category: CategoryKey; amount: number; status: BillStatus;
  dueDay: number | null; note: string; cardId: string | null; planId: string | null; sortOrder: number; inst: Inst | null;
  kind: 'bill' | 'emi' | 'owe'; emiId?: string; entryId?: string;
}

export interface EmiView {
  id: string; cardId: string | null; item: string; forWho: 'me' | 'friend'; freq: Freq; personId: string | null; personName: string;
  monthly: number; amount: number; n: number; total: number | null; ongoing?: boolean; startYm: string; endYm: string | null; received: 'pending' | 'done';
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
/** An EMI / installment. cardId null = paid from the bank / cash. monthly = amount per payment; totalMonths = number of payments (null = ongoing). */
export interface CardEmi { id: string; cardId: string | null; item: string; forWho: 'me' | 'friend'; personId: string | null; monthly: number; freq: Freq; totalMonths: number | null; ongoing?: boolean; startYm: string; }
export interface Plan {
  id: string; name: string; kind: string; source: string; direction: 'out' | 'in'; category: CategoryKey;
  personId: string | null; monthly: number; totalInstallments: number | null; ongoing?: boolean; startYm: string;
}
export interface Person { id: string; name: string; relation: string; phone: string; upi: string; note: string; }
export interface PersonStats extends Person { owed: number; iOwe: number; runningEmis: number; leftToRecover: number; receivedSoFar: number; }

export interface Installment {
  id: string; type: 'emi' | 'plan'; name: string; kind: string; source: string; friend: boolean; incoming: boolean;
  freq: Freq; monthly: number; startYm: string; total: number | null; ongoing?: boolean; n: number; due: boolean; endYm: string | null; monthsLeft: number | null; amountLeft: number | null;
}

/** Daily spends – only for tracking, never part of the budget or balance. */
export type DailySlot = 'teaMorning' | 'breakfast' | 'lunch' | 'snacks' | 'teaEvening' | 'dinner';
export interface DailyOther { name: string; amount: number; }
export type DailyDay = Record<DailySlot, number> & { date: string; others: DailyOther[]; total: number };
export interface DailyMonth { ym: string; today: string; days: DailyDay[]; monthTotal: number; }

export interface YearView {
  year: number; trackedCount: number; budget: number; spent: number; leftOver: number;
  months: ({ ym: string; exists: false } | { ym: string; exists: true; budget: number; spent: number; sudden: number })[];
  categories: { key: string; label: string; total: number }[];
}

/** Look & feel saved in the account (null = not chosen yet). */
export type HomeLang = 'ta' | 'te' | 'hi';
export type SidebarStyle = 'classic' | 'pin';
export interface Prefs { theme: 'light' | 'dark' | null; accent: string | null; lang: HomeLang | null; sidebar?: SidebarStyle | null; sidebarPinned?: boolean | null; aiName?: string | null; }
export interface Account { email: string; phone: string; isAdmin?: boolean; aiAllowed?: boolean; prefs?: Prefs; }
/** A login as the Admin page shows it – never any money data. */
export interface AdminUser { id: string; email: string; phone: string; isAdmin: boolean; aiAllowed: boolean; createdAt: string; lastSignInAt: string | null; online: boolean; }
export interface ChangeResult { message: string; undoToken: string; id?: string; }
