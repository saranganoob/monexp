import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AiStatus { enabled: boolean; model: string; }
export interface AiSummaryView { enabled: boolean; summary: { text: string; createdAt: string; model: string } | null; stale: boolean; }
export interface ChatTurn { role: 'user' | 'assistant'; content: string; }
export type ChatEvent =
  | { type: 'status'; text: string }
  | { type: 'text'; delta: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** Talks to /api/ai. The Claude API key never reaches the browser – only the backend calls Claude. */
@Injectable({ providedIn: 'root' })
export class AiService {
  private http = inject(HttpClient);

  status() { return firstValueFrom(this.http.get<AiStatus>('/api/ai/status')); }
  summary(ym: string) { return firstValueFrom(this.http.get<AiSummaryView>(`/api/ai/summary/${ym}`)); }
  generateSummary(ym: string) { return firstValueFrom(this.http.post<AiSummaryView>(`/api/ai/summary/${ym}`, {})); }

  /**
   * Streams an answer. The backend replies with server-sent events; HttpClient can't stream
   * a POST body back, so this uses fetch and reads the stream.
   */
  async chat(messages: ChatTurn[], ym: string, onEvent: (e: ChatEvent) => void, signal: AbortSignal): Promise<void> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ messages, ym }),
      signal,
    });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null);
      onEvent({ type: 'error', message: body?.error || `Something went wrong (${res.status}).` });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.*)$/m.exec(chunk)?.[1];
        const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] ?? '{}');
        if (event === 'status') onEvent({ type: 'status', text: data.text });
        else if (event === 'text') onEvent({ type: 'text', delta: data.delta });
        else if (event === 'error') onEvent({ type: 'error', message: data.message });
        else if (event === 'done') onEvent({ type: 'done' });
      }
    }
  }
}
