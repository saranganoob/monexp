import mongoose from 'mongoose';
import { Schema } from './common.js';

// How MonEXP looks for this person – follows them to every device. null = not chosen yet.
const prefsSchema = new Schema({
  theme: { type: String, enum: ['light', 'dark', null], default: null },
  accent: { type: String, match: /^#[0-9A-F]{6}$/, default: null },
  lang: { type: String, enum: ['ta', 'te', 'hi', null], default: null }, // home-language hints; null = English only
}, { _id: false });

const userSchema = new Schema({
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  phone: { type: String, match: /^([6-9]\d{9})?$/, default: '' },
  passwordHash: { type: String, required: true },
  isAdmin: { type: Boolean, default: false }, // can open the Admin page (manage logins – never other people's money)
  lastSignInAt: { type: Date, default: null },
  prefs: { type: prefsSchema, default: () => ({}) },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
