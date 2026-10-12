import mongoose from 'mongoose';
import { Schema } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// A snapshot taken before a change, so the "Undo" toast can put things back.
const undoSchema = new Schema({
  label: String,
  parts: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // auto-deleted after 1 hour
});

undoSchema.plugin(ownerPlugin);

export const Undo = mongoose.model('Undo', undoSchema);
