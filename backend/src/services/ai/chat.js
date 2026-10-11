// "Ask MonEXP": a streaming chat where Claude calls read-only tools for the figures.
import Anthropic from '@anthropic-ai/sdk';
import { baseParams, getClient } from './client.js';
import { CHAT_SYSTEM } from './prompts.js';
import { TOOL_DEFINITIONS, runTool, toolStatus } from './tools.js';
import { todayIso, ymLabel } from '../../lib/ym.js';

const MAX_TURNS = 8; // tool round-trips per question

/** A problem worth showing as-is (not an API error). */
export class ChatError extends Error {}
const MAX_JSON_RETRIES = 2;

/**
 * history: [{ role: 'user' | 'assistant', content: string }], ending with the new question.
 * send(event, data): writes one server-sent event to the browser.
 */
export async function streamChat({ history, ym, send, signal }) {
  const client = getClient();
  const context = `[Context: today is ${todayIso()}. The person is viewing ${ymLabel(ym)} (${ym}) in the app, so "this month" means ${ymLabel(ym)} unless they say otherwise.]`;
  const messages = history.map((m, i) => ({
    role: m.role,
    content: i === history.length - 1 ? `${context}\n\n${m.content}` : m.content,
  }));

  let wroteText = false;   // anything shown yet?
  let needsBreak = false;  // put a blank line before text that follows a tool call
  let jsonRetries = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.beta.messages.stream({
      ...baseParams(),
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: CHAT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOL_DEFINITIONS,
      messages,
    }, { signal });

    stream.on('text', (delta) => {
      if (needsBreak && wroteText) send('text', { delta: '\n\n' });
      needsBreak = false;
      wroteText = true;
      send('text', { delta });
    });

    let message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // With eager input streaming a tool input can arrive as unparseable JSON – re-ask that turn.
      if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= MAX_JSON_RETRIES) throw err;
      continue;
    }

    if (message.stop_reason === 'refusal') {
      if (!wroteText) send('text', { delta: 'Sorry, I can’t help with that one.' });
      return;
    }
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }

    const toolUses = message.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) return; // end_turn (or a long text answer that hit max_tokens)
    if (message.stop_reason === 'max_tokens') {
      throw new ChatError('The answer got too long. Try asking a narrower question.');
    }

    // Run every requested tool (in parallel) and answer them all in one message.
    for (const t of toolUses) send('status', { text: toolStatus(t.name, t.input) });
    const results = await Promise.all(toolUses.map(async (t) => {
      const { content, isError } = await runTool(t.name, t.input);
      return { type: 'tool_result', tool_use_id: t.id, content, ...(isError ? { is_error: true } : {}) };
    }));
    messages.push({ role: 'assistant', content: message.content });
    messages.push({ role: 'user', content: results });
    needsBreak = true;
  }
  send('text', { delta: '\n\n(I stopped there – that question needed too many look-ups. Try asking something narrower.)' });
}
