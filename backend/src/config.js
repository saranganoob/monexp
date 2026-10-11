const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/monexp',
  jwtSecret: env.JWT_SECRET || '',
  isProd: env.NODE_ENV === 'production',
  // Demo OTP sign-in: no SMS/email is sent, this fixed 6-digit code is accepted instead.
  // Leave it empty to turn OTP sign-in off.
  devOtp: env.DEV_OTP || '',
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
}
