import mongoose from 'mongoose';

export const { Schema } = mongoose;
export const ObjectId = Schema.Types.ObjectId;

export const amountField = (extra = {}) => ({
  type: Number,
  default: 0,
  min: 0,
  validate: { validator: (v) => v == null || Number.isInteger(v), message: '{PATH} must be whole rupees' },
  ...extra,
});

export const ymField = (extra = {}) => ({ type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/, ...extra });
