import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

const suddenSpendSchema = new Schema({
  ym: ymField({ required: true, index: true }),
  name: { type: String, required: true, trim: true },
  amount: amountField(),
  mode: { type: String, default: 'UPI' }, // "UPI", "Cash", "Bank account", a card name, or free text from the sheet
  card: { type: ObjectId, ref: 'Card', default: null }, // set when paid by card: already in that card's bill
  date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, required: true },
  dateUnknown: { type: Boolean, default: false },
  note: { type: String, default: '' },
}, { timestamps: true });

suddenSpendSchema.plugin(ownerPlugin);

export const SuddenSpend = mongoose.model('SuddenSpend', suddenSpendSchema);
