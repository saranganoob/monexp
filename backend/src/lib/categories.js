// Bill groups on "Need to pay", in display order (from the design).
export const CATEGORIES = [
  { key: 'cc', label: 'Credit card bills' },
  { key: 'fam', label: 'Family & personal' },
  { key: 'house', label: 'Housing' },
  { key: 'sub', label: 'Subscriptions' },
  { key: 'inv', label: 'Investments & savings' },
];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
