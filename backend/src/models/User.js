import mongoose from 'mongoose';
import { Schema } from './common.js';

const userSchema = new Schema({
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  phone: { type: String, match: /^([6-9]\d{9})?$/, default: '' },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
