import { AfterViewChecked, Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStore } from '../../core/app-store';
import { ThemeService } from '../../core/theme.service';
import { AiService, ChatTurn } from '../../core/ai.service';
import { YmPipe } from '../../shared/pipes/ym.pipe';
import { Icon } from '../../shared/ui/icon/icon';

/** `parts` keeps each streamed piece separate so new words can fade in on their own. */
interface Bubble { role: 'user' | 'assistant'; text: string; parts?: string[]; status?: string; error?: boolean; }

const SUGGESTIONS = [
  'Summarise my last 6 months',
  'How much did I spend on credit cards this month?',
  'How much did I pay in EMIs this year?',
  'List my EMIs by closing date',
  'Who still owes me money?',
  'Give me advice for this month',
];

/** The "Ask Kanakku" floating button and the chat panel (the AI's name is each person's choice). */
@Component({
  selector: 'app-ask-ai',
  imports: [ReactiveFormsModule, YmPipe, Icon],
  templateUrl: './ask-ai.html',
  styleUrl: './ask-ai.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class AskAi implements AfterViewChecked, OnDestroy {
  protected store = inject(AppStore);
  protected theme = inject(ThemeService);
  private ai = inject(AiService);
  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly suggestions = SUGGESTIONS;
  protected readonly bubbles = signal<Bubble[]>([]);
  protected readonly busy = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    question: ['', [Validators.required, Validators.maxLength(1000)]],
  });
  protected readonly showFab = computed(() => !this.store.askAiOpen() && !this.store.dialog());
  private abort: AbortController | null = null;
  private stickToBottom = true;

  open() {
    this.stickToBottom = true; // reopen at the latest message
    this.store.askAiOpen.set(true);
    setTimeout(() => document.getElementById('askAiInput')?.focus());
  }

  /** Hides the panel; the conversation (and an answer still coming in) stays until Clear. */
  close() {
    if (!this.store.askAiOpen()) return;
    this.store.askAiOpen.set(false);
  }

  clear() {
    this.abort?.abort();
    this.bubbles.set([]);
  }

  ask(text?: string) {
    const q = (text ?? this.form.controls.question.value).trim();
    if (!q || this.busy()) return;
    this.form.reset();
    this.send(q);
  }

  private async send(q: string) {
    const history: ChatTurn[] = [
      ...this.bubbles().filter((b) => !b.error && b.text).map((b) => ({ role: b.role, content: b.text })),
      { role: 'user', content: q },
    ];
    this.bubbles.update((list) => [...list, { role: 'user', text: q }, { role: 'assistant', text: '', status: `${this.theme.aiName()} is thinking…` }]);
    this.stickToBottom = true;
    this.busy.set(true);
    this.abort = new AbortController();

    const patchLast = (fn: (b: Bubble) => Bubble) => this.bubbles.update((list) => [...list.slice(0, -1), fn(list[list.length - 1])]);
    try {
      await this.ai.chat(history, this.store.ym(), (e) => {
        if (e.type === 'status') patchLast((b) => ({ ...b, status: e.text }));
        else if (e.type === 'text') patchLast((b) => ({ ...b, text: b.text + e.delta, parts: [...(b.parts ?? []), e.delta], status: undefined }));
        else if (e.type === 'error') patchLast((b) => ({ ...b, text: b.text ? `${b.text}\n\n${e.message}` : e.message, parts: undefined, status: undefined, error: true }));
      }, this.abort.signal);
    } catch (err) {
      if (!this.abort?.signal.aborted) {
        patchLast((b) => ({ ...b, text: 'Can’t reach the MonEXP server. Is the backend running?', status: undefined, error: true }));
      }
    } finally {
      patchLast((b) => (b.status ? { ...b, status: undefined, text: b.text || 'No answer came back. Try again.', error: !b.text } : b));
      this.busy.set(false);
      this.abort = null;
    }
  }

  onScroll(el: HTMLElement) {
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  ngAfterViewChecked() {
    const el = this.scroller()?.nativeElement;
    if (el && this.stickToBottom) el.scrollTop = el.scrollHeight;
  }

  ngOnDestroy() { this.abort?.abort(); }
}
