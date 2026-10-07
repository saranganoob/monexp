const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/monexp',
  jwtSecret: env.JWT_SECRET || '',
  isProd: env.NODE_ENV === 'production',
};

export function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters. Set it in backend/.env (see .env.example).');
  }
}
