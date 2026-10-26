// Bill groups on "Need to pay", in display order (from the design).
// `auto` groups are filled by the app itself – bank/cash EMIs and money I owe people – and
// can't be picked for a bill.
export const CATEGORIES = [
  { key: 'cc', label: 'Credit card bills' },
  { key: 'fam', label: 'Family & personal' },
  { key: 'house', label: 'Housing' },
  { key: 'sub', label: 'Subscriptions' },
  { key: 'inv', label: 'Investments & savings' },
  { key: 'emi', label: 'EMIs & installments', auto: true },
  { key: 'owe', label: 'Money I owe', auto: true },
];
export const CATEGORY_KEYS = CATEGORIES.filter((c) => !c.auto).map((c) => c.key);
