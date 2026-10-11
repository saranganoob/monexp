import { Router } from 'express';
import { aiEnabled, friendlyAiError, getClient } from '../services/ai/client.js';
import { ChatError, streamChat } from '../services/ai/chat.js';
import { generateSummary, getSummary } from '../services/ai/summary.js';
import { config } from '../config.js';
import { badRequest, HttpError } from '../lib/http.js';
import { toYm } from '../lib/validate.js';

const router = Router();
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 4000;

router.get('/status', (_req, res) => {
  res.json({ enabled: aiEnabled(), model: config.anthropicModel });
});

/** Checks the chat history from the browser: alternating plain-text turns, ending with a question. */
function readHistory(body) {
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-MAX_HISTORY) : null;
  if (!raw?.length) throw badRequest('Ask a question first.');
  const history = raw.map((m) => {
    if (!['user', 'assistant'].includes(m?.role) || typeof m.content !== 'string') throw badRequest('Each message needs a role and text.');
    const content = m.content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content) throw badRequest('Messages can’t be empty.');
    return { role: m.role, content };
  });
  while (history.length && history[0].role !== 'user') history.shift(); // must start with a question
  if (!history.length || history.at(-1).role !== 'user') throw badRequest('The last message must be your question.');
  return history;
}

// POST /api/ai/chat  { messages: [{ role, content }], ym } – answers as server-sent events:
//   event: status {text}   event: text {delta}   event: error {message}   event: done {}
router.post('/chat', async (req, res) => {
  const history = readHistory(req.body);
  const ym = toYm(req.body?.ym, 'ym');
  getClient(); // a missing API key is reported here, as a normal 503 – before streaming starts

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  // Stop calling Claude if the person closes the panel mid-answer.
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });

  try {
    await streamChat({ history, ym, send, signal: abort.signal });
    send('done', {});
  } catch (err) {
    if (!abort.signal.aborted) {
      if (!(err instanceof ChatError || err instanceof HttpError)) console.error('AI chat failed:', err?.status ?? '', err?.message);
      send('error', { message: err instanceof ChatError ? err.message : friendlyAiError(err) });
    }
  } finally {
    res.end();
  }
});

router.get('/summary/:ym', async (req, res) => {
  res.json(await getSummary(toYm(req.params.ym)));
});

router.post('/summary/:ym', async (req, res) => {
  try {
    res.json(await generateSummary(toYm(req.params.ym)));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('AI summary failed:', err?.status ?? '', err?.message);
    throw new HttpError(502, friendlyAiError(err));
  }
});

export default router;
