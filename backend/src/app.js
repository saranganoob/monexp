import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import monthRoutes from './routes/months.js';
import itemRoutes from './routes/items.js';
import setupRoutes from './routes/setup.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // On Render the app sits behind a proxy: trust it for the real client IP and HTTPS.
  if (config.isProd) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Angular adds component styles at runtime; the font comes from Google Fonts.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: config.cookieSecure ? [] : null,
      },
    },
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Slow down password / OTP guessing: a limited number of attempts per IP per 15 minutes.
  const signInLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.loginRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  });
  app.use(['/api/auth/login', '/api/auth/otp/request', '/api/auth/otp/verify'], signInLimit);
  app.use('/api/auth', authRoutes);

  // Everything below needs a signed-in user.
  app.use('/api', requireAuth);
  app.use('/api/months', monthRoutes);
  app.use('/api', itemRoutes);
  app.use('/api', setupRoutes);
  app.use('/api', reportRoutes);
  app.use('/api/ai', aiRoutes);

  app.use('/api', notFoundHandler);

  // The Angular app (after `npm run build`): static files, and index.html for every page route.
  const indexHtml = path.join(config.webDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.webDir, {
      index: false,
      // Built files have content hashes in their names, so they can be cached for long.
      setHeaders: (res, file) => {
        if (/-[0-9A-Z]{8}\.(js|css)$/.test(file) || /[\\/]media[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}
