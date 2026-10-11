import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import { HttpError } from '../../lib/http.js';

// Models that accept the server-side refusal fallback ("fallbacks": "default").
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

let client = null;

export const aiEnabled = () => Boolean(config.anthropicApiKey) || client !== null;

/** The Anthropic client – created on first use. Tests can swap in a fake with setClientForTests(). */
export function getClient() {
  if (client) return client;
  if (!config.anthropicApiKey) {
    throw new HttpError(503, 'The AI assistant isn’t set up yet. Add your Claude API key to backend/.env (ANTHROPIC_API_KEY=…) and restart the backend.');
  }
  client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

export function setClientForTests(fake) {
  client = fake;
}

/** Common request settings: model, and the refusal fallback where the model supports it. */
export function baseParams() {
  const model = config.anthropicModel;
  return FALLBACK_MODELS.has(model)
    ? { model, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
    : { model };
}

/** Turns SDK errors into a message the person using the app can act on. */
export function friendlyAiError(err) {
  if (err instanceof HttpError) return err.message;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return 'Claude didn’t accept the API key. Check ANTHROPIC_API_KEY in backend/.env and restart the backend.';
  }
  if (err instanceof Anthropic.RateLimitError) return 'Claude is busy right now (rate limit). Wait a minute and try again.';
  if (err instanceof Anthropic.APIConnectionError) return 'Can’t reach Claude. Check your internet connection and try again.';
  if (err instanceof Anthropic.BadRequestError) return `Claude couldn’t handle that request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude had a problem (${err.status ?? 'error'}). Try again in a moment.`;
  return 'Something went wrong talking to Claude.';
}
