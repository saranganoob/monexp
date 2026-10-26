import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';
import { runAsOwner } from '../lib/owner.js';
import { User } from '../models/index.js';

export const SESSION_COOKIE = 'monexp_session';

export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(new HttpError(401, 'Please sign in.'));
  try {
    req.userId = jwt.verify(token, config.jwtSecret).sub;
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
  // A login the admin deleted stops working at once, even with a session cookie that hasn't expired.
  if (!(await User.exists({ _id: req.userId }).catch(() => null))) return next(new HttpError(401, 'This login no longer exists.'));
  // Everything after this only sees and changes this user's money data.
  runAsOwner(req.userId, next);
}
