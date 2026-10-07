import mongoose from 'mongoose';
import { HttpError } from '../lib/http.js';

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `No API route for ${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(' ') });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: `Invalid value for ${err.path}.` });
  if (err?.code === 11000) return res.status(409).json({ error: 'That already exists.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
}
