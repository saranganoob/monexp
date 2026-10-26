import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// An EMI or installment – mine, or one I pay for a friend. Paid from one of my cards
// (it's added to that card's bill) or from the bank / cash (card = null: its own row in Need to pay).
const cardEmiSchema = new Schema({
  card: { type: ObjectId, ref: 'Card', default: null },
  item: { type: String, required: true, trim: true },
  forWho: { type: String, enum: ['me', 'friend'], default: 'me' },
  person: { type: ObjectId, ref: 'Person', default: null },
  monthly: amountField(), // amount per payment (per month, or per year for yearly plans)
  freq: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  totalMonths: { type: Number, required: true, min: 1, max: 600, validate: Number.isInteger }, // number of payments
  startYm: ymField({ required: true }), // month of payment 1
}, { timestamps: true });

cardEmiSchema.plugin(ownerPlugin);

export const CardEmi = mongoose.model('CardEmi', cardEmiSchema);
