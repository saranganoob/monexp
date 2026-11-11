import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// One itemised purchase on a card, e.g. "Supermarket ₹321 on 10 Oct".
// The month's cardSpends total includes these; anything not itemised shows as "Not itemised".
const cardSpendSchema = new Schema({
  ym: ymField({ required: true, index: true }),
  card: { type: ObjectId, ref: 'Card', required: true },
  name: { type: String, required: true, trim: true },
  amount: amountField(),
  date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, required: true },
  // Bought for a friend: who it's for, and the "they owe me" entry it's linked to (removed together).
  person: { type: ObjectId, ref: 'Person', default: null },
  entry: { type: ObjectId, ref: 'PeopleEntry', default: null },
  emi: { type: ObjectId, ref: 'CardEmi', default: null }, // the one-time fee of a friend's EMI purchase
}, { timestamps: true });

cardSpendSchema.plugin(ownerPlugin);

export const CardSpend = mongoose.model('CardSpend', cardSpendSchema);
