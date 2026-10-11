import mongoose from 'mongoose';
import { Schema, ymField } from './common.js';

// The AI-written summary for a month, cached so it isn't regenerated (and paid for) on every visit.
const aiSummarySchema = new Schema({
  ym: ymField({ required: true, unique: true }),
  text: { type: String, required: true },
  model: { type: String, default: '' },
  dataHash: { type: String, required: true }, // hash of the figures it was written from – changes mean "out of date"
}, { timestamps: true });

export const AiSummary = mongoose.model('AiSummary', aiSummarySchema);
