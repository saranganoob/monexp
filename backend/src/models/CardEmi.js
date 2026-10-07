import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';

// An EMI running on one of my cards – mine, or a purchase made for a friend.
const cardEmiSchema = new Schema({
  card: { type: ObjectId, ref: 'Card', required: true },
  item: { type: String, required: true, trim: true },
  forWho: { type: String, enum: ['me', 'friend'], default: 'me' },
  person: { type: ObjectId, ref: 'Person', default: null },
  monthly: amountField(),
  totalMonths: { type: Number, required: true, min: 1, validate: Number.isInteger },
  startYm: ymField({ required: true }), // month of installment 1
}, { timestamps: true });

export const CardEmi = mongoose.model('CardEmi', cardEmiSchema);
