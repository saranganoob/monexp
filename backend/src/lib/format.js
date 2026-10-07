// ₹1,00,000 – Indian digit grouping.
export const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
