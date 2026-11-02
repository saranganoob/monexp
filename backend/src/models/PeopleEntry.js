import mongoose from 'mongoose';
import { Schema, ObjectId, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// Money between me and someone else in a given month.
// direction "in" = they owe me, "out" = I owe them.
const peopleEntrySchema = new Schema({
  ym: ymField({ required: true, index: true }),
  direction: { type: String, enum: ['in', 'out'], required: true },
  person: { type: ObjectId, ref: 'Person', default: null },
  name: { type: String, required: true, trim: true }, // shown as-is, e.g. "Vinod · trip advance"
  amount: amountField(),
  status: { type: String, enum: ['pending', 'done', 'moved'], default: 'pending' },
  plan: { type: ObjectId, ref: 'Plan', default: null },
  note: { type: String, default: '' },
  carriedFrom: ymField({ default: null }), // set on the copy in the new month
  movedTo: ymField({ default: null }),     // set on the original when carried over
  origin: { type: ObjectId, ref: 'PeopleEntry', default: null },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

peopleEntrySchema.plugin(ownerPlugin);

export const PeopleEntry = mongoose.model('PeopleEntry', peopleEntrySchema);
