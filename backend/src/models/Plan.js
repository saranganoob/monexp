import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { CATEGORY_KEYS } from '../lib/categories.js';

// Installment plans that aren't card EMIs: money I send on a schedule (Dad, gold chit)
// or someone paying me back in parts (Madhan's gym).
const planSchema = new Schema({
  name: { type: String, required: true, trim: true },
  kind: { type: String, default: '' },   // e.g. "Monthly support", "Savings (chit)"
  source: { type: String, default: '' }, // short description shown under the name
  direction: { type: String, enum: ['out', 'in'], default: 'out' },
  category: { type: String, enum: CATEGORY_KEYS, default: 'fam' }, // group of the monthly bill (out plans)
  person: { type: ObjectId, ref: 'Person', default: null },
  monthly: amountField(),
  totalInstallments: { type: Number, required: true, min: 1, validate: Number.isInteger },
  startYm: ymField({ required: true }),
}, { timestamps: true });

export const Plan = mongoose.model('Plan', planSchema);
