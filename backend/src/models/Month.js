import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';

const emiOverrideSchema = new Schema({
  emi: { type: ObjectId, ref: 'CardEmi', required: true },
  amount: { ...amountField(), default: null }, // null = use the EMI's normal monthly amount
  received: { type: String, enum: ['pending', 'done'], default: 'pending' }, // friend EMIs only
}, { _id: false });

const monthSchema = new Schema({
  ym: ymField({ required: true, unique: true }),
  budget: amountField(),
  // "My spends" on each card this month, keyed by card id.
  cardSpends: { type: Map, of: amountField(), default: {} },
  emiOverrides: { type: [emiOverrideSchema], default: [] },
  createdHow: { type: String, enum: ['seed', 'import', 'rollover', 'blank'], default: 'blank' },
}, { timestamps: true });

export const Month = mongoose.model('Month', monthSchema);
