import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AppStore } from '../../../core/app-store';
import { AiService, AiSummaryView } from '../../../core/ai.service';
import { errorMessage } from '../../../core/api.service';
import { YmPipe } from '../../../shared/pipes/ym.pipe';
import { Icon } from '../../../shared/ui/icon/icon';

/** The AI-written note about the month. Written on request, then saved. */
@Component({
  selector: 'app-ai-summary',
  imports: [DatePipe, YmPipe, Icon],
  templateUrl: './ai-summary.html',
  styleUrl: './ai-summary.scss',
})
export class AiSummary {
  private ai = inject(AiService);
  private store = inject(AppStore);
  readonly ym = input.required<string>();

  protected readonly view = signal<AiSummaryView | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  /** True right after Claude writes a new note, so it appears sentence by sentence. */
  protected readonly reveal = signal(false);
  protected readonly sentences = computed(() => this.view()?.summary?.text.match(/[^.!?\n]+[.!?]*["')\]]*\s*|\n+/g) ?? []);

  constructor() {
    // Reading the saved summary is free; only "Summarise" / "Refresh" calls Claude.
    effect(async () => {
      const ym = this.ym();
      this.store.version();
      try {
        this.view.set(await this.ai.summary(ym));
        this.reveal.set(false);
        this.error.set('');
      } catch (e) {
        this.error.set(errorMessage(e));
      }
    });
  }

  async generate() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.view.set(await this.ai.generateSummary(this.ym()));
      this.reveal.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  openChat() { this.store.askAiOpen.set(true); }
}
