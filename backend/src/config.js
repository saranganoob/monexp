import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(env.PORT || 3000),
  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/monexp',
  jwtSecret: env.JWT_SECRET || '',
  isProd,
  // Login cookie is HTTPS-only in production. COOKIE_SECURE=false lets you try a production
  // build on http://localhost.
  cookieSecure: isProd && env.COOKIE_SECURE !== 'false',
  // Demo OTP sign-in: no SMS/email is sent, this fixed 6-digit code is accepted instead.
  // Always off in production – on the open internet anyone knowing your email could use it.
  devOtp: isProd ? '' : env.DEV_OTP || '',
  // Sign-in attempts allowed per IP address per 15 minutes.
  loginRateLimit: Number(env.LOGIN_RATE_LIMIT || 20),
  // The built Angular app, served by Express when it exists (one app on Render).
  webDir: env.WEB_DIR || path.resolve(here, '../../frontend/dist/frontend/browser'),
  // Claude API (AI features). The key is only ever read here, never logged or sent to the browser.
  anthropicApiKey: env.ANTHROPIC_API_KEY || '',
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
};

export function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters. Set it in backend/.env (see .env.example).');
  }
  if (config.devOtp && !/^\d{6}$/.test(config.devOtp)) {
    throw new Error('DEV_OTP in backend/.env must be exactly 6 digits, or empty to turn OTP sign-in off.');
  }
  if (isProd && /localhost|127\.0\.0\.1/.test(config.mongoUri) && env.ALLOW_LOCAL_DB !== 'true') {
    throw new Error('MONGODB_URI points at localhost in production. Set it to your MongoDB Atlas connection string.');
  }
}
