import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

const emiOverrideSchema = new Schema({
  emi: { type: ObjectId, ref: 'CardEmi', required: true },
  amount: { ...amountField(), default: null }, // null = use the EMI's normal monthly amount
  received: { type: String, enum: ['pending', 'done'], default: 'pending' }, // friend EMIs only
  paid: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },      // bank / cash EMIs only (their Need to pay row)
}, { _id: false });

const monthSchema = new Schema({
  ym: ymField({ required: true }),
  budget: amountField(),
  // "My spends" on each card this month, keyed by card id.
  cardSpends: { type: Map, of: amountField(), default: {} },
  emiOverrides: { type: [emiOverrideSchema], default: [] },
  createdHow: { type: String, enum: ['seed', 'import', 'rollover', 'blank'], default: 'blank' },
}, { timestamps: true });

monthSchema.plugin(ownerPlugin);
monthSchema.index({ owner: 1, ym: 1 }, { unique: true }); // one per month, per user

export const Month = mongoose.model('Month', monthSchema);
