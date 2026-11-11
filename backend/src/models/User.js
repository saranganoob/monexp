import mongoose from 'mongoose';
import { Schema } from './common.js';

// The menu sections a person can reorder or hide (Overview is always first; Admin always last).
export const MENU_KEYS = ['pay', 'cards', 'installments', 'people', 'sudden', 'daily', 'year'];

// How MonEXP looks for this person – follows them to every device. null = not chosen yet.
const prefsSchema = new Schema({
  theme: { type: String, enum: ['light', 'dark', null], default: null },
  accent: { type: String, match: /^#[0-9A-F]{6}$/, default: null },
  lang: { type: String, enum: ['ta', 'te', 'hi', null], default: null }, // home-language hints; null = English only
  sidebar: { type: String, enum: ['classic', 'pin', null], default: null }, // web sidebar style; null = classic
  sidebarPinned: { type: Boolean, default: null },
  aiName: { type: String, trim: true, maxlength: 24, default: null }, // what this person calls the AI; null = the default name // 'pin' style: stays open (true) or opens on hover (false); null = pinned
  calculator: { type: Boolean, default: null }, // calculator button in the top bar (web); null = on
  dailyInBudget: { type: Boolean, default: null }, // daily spends come off the month's balance; null = yes
  suddenInBudget: { type: Boolean, default: null }, // sudden spends come off the month's balance; null = no (a note only)
  dailyLimit: { type: Number, default: null, min: 1, max: 1000000 }, // daily spends limit per day (₹); null = off
  navOrder: { type: [{ type: String, enum: MENU_KEYS }], default: undefined }, // menu order; none = the default order
  navHidden: { type: [{ type: String, enum: MENU_KEYS }], default: undefined }, // menu sections switched off
}, { _id: false });

const userSchema = new Schema({
  name: { type: String, trim: true, maxlength: 40, default: '' }, // shown at the top right; '' = taken from the email
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  phone: { type: String, match: /^([6-9]\d{9})?$/, default: '' },
  passwordHash: { type: String, required: true },
  isAdmin: { type: Boolean, default: false }, // can open the Admin page (manage logins – never other people's money)
  aiAllowed: { type: Boolean, default: false }, // admin switched AI on for this login (the admin always has it)
  lastSignInAt: { type: Date, default: null },
  prefs: { type: prefsSchema, default: () => ({}) },
}, { timestamps: true });

/** The AI's name unless the person picks their own (Tamil for "accounts"). */
export const DEFAULT_AI_NAME = 'Kanakku';

/** Whether this login may use Ask AI and the AI summary. */
export const canUseAi = (u) => Boolean(u?.isAdmin || u?.aiAllowed);

export const User = mongoose.model('User', userSchema);
