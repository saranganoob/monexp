import mongoose from 'mongoose';
import { Schema, amountField, ymField } from './common.js';
import { ownerPlugin } from './ownerPlugin.js';

// The fixed slots of a day, in the order they happen.
export const DAILY_SLOTS = ['teaMorning', 'breakfast', 'lunch', 'snacks', 'teaEvening', 'dinner'];

const otherSchema = new Schema({
  name: { type: String, trim: true, maxlength: 60, default: '' },
  amount: amountField(),
}, { _id: false });

// One day of everyday spends (food, tea, small things). Only for tracking: it never touches the
// month's budget or balance.
const dailySpendSchema = new Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  ym: ymField({ required: true }),
  ...Object.fromEntries(DAILY_SLOTS.map((k) => [k, amountField()])),
  others: { type: [otherSchema], default: [] },
}, { timestamps: true });

dailySpendSchema.plugin(ownerPlugin);
dailySpendSchema.index({ owner: 1, date: 1 }, { unique: true }); // one per day, per user

export const DailySpend = mongoose.model('DailySpend', dailySpendSchema);
