import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import monthRoutes from './routes/months.js';
import itemRoutes from './routes/items.js';
import setupRoutes from './routes/setup.js';
import reportRoutes from './routes/reports.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);

  // Everything below needs a signed-in user.
  app.use('/api', requireAuth);
  app.use('/api/months', monthRoutes);
  app.use('/api', itemRoutes);
  app.use('/api', setupRoutes);
  app.use('/api', reportRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
