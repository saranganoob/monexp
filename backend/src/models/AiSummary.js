import mongoose from 'mongoose';
import { Schema, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// The AI-written summary for a month, cached so it isn't regenerated (and paid for) on every visit.
const aiSummarySchema = new Schema({
  ym: ymField({ required: true }),
  text: { type: String, required: true },
  model: { type: String, default: '' },
  dataHash: { type: String, required: true }, // hash of the figures it was written from – changes mean "out of date"
}, { timestamps: true });

aiSummarySchema.plugin(ownerPlugin);
aiSummarySchema.index({ owner: 1, ym: 1 }, { unique: true }); // one per month, per user

export const AiSummary = mongoose.model('AiSummary', aiSummarySchema);
