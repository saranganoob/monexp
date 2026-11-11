import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// One part received / paid back (e.g. ₹6,000 of ₹10,000).
const partSchema = new Schema({
  amount: amountField(),
  date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, required: true },
}, { timestamps: false });

// Money between me and someone else in a given month.
// direction "in" = they owe me, "out" = I owe them.
// Parts can come in bit by bit (`parts`); once they add up to `amount` the entry is "done".
const peopleEntrySchema = new Schema({
  ym: ymField({ required: true, index: true }),
  direction: { type: String, enum: ['in', 'out'], required: true },
  person: { type: ObjectId, ref: 'Person', default: null },
  name: { type: String, required: true, trim: true }, // shown as-is, e.g. "Vinod · trip advance"
  amount: amountField(),
  status: { type: String, enum: ['pending', 'done', 'moved'], default: 'pending' },
  parts: { type: [partSchema], default: [] },
  plan: { type: ObjectId, ref: 'Plan', default: null },
  note: { type: String, default: '' },
  carriedFrom: ymField({ default: null }), // set on the copy in the new month
  movedTo: ymField({ default: null }),     // set on the original when carried over
  origin: { type: ObjectId, ref: 'PeopleEntry', default: null },
  // Bought for a friend on my card: the card purchase this is for (removed together), or the friend EMI whose fee it is.
  cardSpend: { type: ObjectId, ref: 'CardSpend', default: null },
  emi: { type: ObjectId, ref: 'CardEmi', default: null },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

peopleEntrySchema.plugin(ownerPlugin);

export const PeopleEntry = mongoose.model('PeopleEntry', peopleEntrySchema);
