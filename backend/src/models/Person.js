import mongoose from 'mongoose';
import { Schema } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

export const RELATIONS = ['', 'Friend', 'Family', 'Colleague', 'Roommate', 'Other'];

const personSchema = new Schema({
  name: { type: String, required: true, trim: true },
  relation: { type: String, enum: RELATIONS, default: '' },
  phone: { type: String, match: /^([6-9]\d{9})?$/, default: '' },
  upi: { type: String, default: '' },
  note: { type: String, default: '' },
}, { timestamps: true });

personSchema.plugin(ownerPlugin);

export const Person = mongoose.model('Person', personSchema);
