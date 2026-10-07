import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { CATEGORY_KEYS } from '../lib/categories.js';

// One row in a month's "Need to pay" list.
const billItemSchema = new Schema({
  ym: ymField({ required: true, index: true }),
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: CATEGORY_KEYS, required: true },
  amount: amountField(), // ignored for card bills – those are calculated
  status: { type: String, enum: ['paid', 'unpaid', 'skipped'], default: 'unpaid' },
  dueDay: { type: Number, min: 1, max: 31, default: null },
  note: { type: String, default: '' },
  card: { type: ObjectId, ref: 'Card', default: null },
  plan: { type: ObjectId, ref: 'Plan', default: null },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export const BillItem = mongoose.model('BillItem', billItemSchema);
