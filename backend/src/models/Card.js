import mongoose from 'mongoose';
import { Schema } from './common.js';

export const NETWORKS = ['', 'Visa', 'RuPay', 'Maestro', 'Mastercard'];

// Only what's needed to tell cards apart – never the full number or CVV.
const cardSchema = new Schema({
  name: { type: String, required: true, trim: true },
  last4: { type: String, match: /^(\d{4})?$/, default: '' },
  network: { type: String, enum: NETWORKS, default: '' },
  closedOn: { type: String, match: /^(\d{4}-\d{2}-\d{2})?$/, default: '' }, // '' = open
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export const Card = mongoose.model('Card', cardSchema);
