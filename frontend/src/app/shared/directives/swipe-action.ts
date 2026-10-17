import { DOCUMENT, Directive, ElementRef, OnDestroy, inject, input, output } from '@angular/core';
import { projectMomentum, rubberband, springTo } from '../utils/spring';

const START_SLOP = 10;       // px of movement before we decide it's a horizontal swipe (not a scroll)
const COMMIT_RATIO = 0.35;   // past 35% of the row width (or 120px) the swipe counts
const COMMIT_MAX = 120;
const HISTORY_MS = 100;      // finger positions kept for measuring release speed

/**
 * Swipe right on a row to run an action (phones and touch screens only – mouse users have the buttons).
 * The row follows the finger 1:1, resists past the edges, and springs back with the finger's speed.
 * Sets `--swipe-progress` (0 → 1 at the commit point) and `is-swiping` on its parent so a
 * background label can fade in behind it.
 *
 *   <div class="swipe"><div class="swipe-bg">Paid</div><div class="front" appSwipeAction (swiped)="pay()">…</div></div>
 */
@Directive({
  selector: '[appSwipeAction]',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'cancel()',
    '(click)': 'swallowClickAfterSwipe($event)',
    'style': 'touch-action: pan-y',
  },
})
export class SwipeAction implements OnDestroy {
  readonly enabled = input(true, { alias: 'swipeEnabled' });
  readonly swiped = output<void>();

  private el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private reducedMotion = inject(DOCUMENT).defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  private x = 0;
  private state: 'idle' | 'pending' | 'dragging' = 'idle';
  private startX = 0;
  private startY = 0;
  private grabX = 0; // where the row was when the finger came down (respects the grab point)
  private history: { x: number; t: number }[] = [];
  private stopSpring?: () => void;
  private justSwiped = false;

  protected down(e: PointerEvent) {
    if (!this.enabled() || e.pointerType === 'mouse' || !e.isPrimary) return;
    this.stopSpring?.(); // grab it mid-flight: carry on from where it is
    this.state = 'pending';
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.grabX = this.x;
    this.history = [{ x: e.clientX, t: e.timeStamp }];
  }

  protected move(e: PointerEvent) {
    if (this.state === 'idle') return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    if (this.state === 'pending') {
      if (Math.abs(dy) > START_SLOP && Math.abs(dy) > Math.abs(dx)) { this.release(); return; } // it's a scroll
      if (Math.abs(dx) < START_SLOP) return;
      this.state = 'dragging';
      this.el.setPointerCapture(e.pointerId);
      this.el.parentElement?.classList.add('is-swiping');
    }
    this.history.push({ x: e.clientX, t: e.timeStamp });
    while (this.history.length > 2 && e.timeStamp - this.history[0].t > HISTORY_MS) this.history.shift();
    const width = this.el.offsetWidth;
    const raw = this.grabX + dx;
    // Only rightwards does something; the left edge and anything past the row's width resist.
    this.set(raw < 0 ? rubberband(raw, width) : raw > width ? width + rubberband(raw - width, width) : raw);
  }

  protected up(e: PointerEvent) {
    if (this.state !== 'dragging') { this.release(); return; }
    this.state = 'idle';
    const first = this.history[0];
    const elapsed = (e.timeStamp - first.t) / 1000;
    const velocity = elapsed > 0 ? (e.clientX - first.x) / elapsed : 0;
    const commitAt = Math.min(this.el.offsetWidth * COMMIT_RATIO, COMMIT_MAX);
    // Decide from where the gesture was heading, not just where the finger stopped.
    const commit = this.x + projectMomentum(velocity) >= commitAt && velocity > -200;
    this.justSwiped = true;
    if (commit) {
      navigator.vibrate?.(10); // a tiny tick on phones that support it, in the same frame as the action
      this.swiped.emit();
    }
    // Spring home carrying the finger's speed; a little bounce only because it was thrown.
    this.animateTo(0, { velocity, damping: commit ? 0.8 : 1, response: commit ? 0.3 : 0.35 });
  }

  protected cancel() {
    this.release();
  }

  /** Not a swipe after all: if the row was grabbed mid-spring, let it settle home. */
  private release() {
    this.state = 'idle';
    if (this.x) this.animateTo(0, {});
  }

  /** A swipe ends with a "click" on whatever was under the finger – don't let it press the tick too. */
  protected swallowClickAfterSwipe(e: MouseEvent) {
    if (!this.justSwiped) return;
    this.justSwiped = false;
    e.preventDefault();
    e.stopPropagation();
  }

  private animateTo(target: number, opts: { velocity?: number; damping?: number; response?: number }) {
    if (this.reducedMotion?.matches) {
      this.set(target);
      this.done();
      return;
    }
    this.stopSpring = springTo(this.x, target, opts, (x) => this.set(x), () => this.done());
  }

  private done() {
    this.el.parentElement?.classList.remove('is-swiping');
    setTimeout(() => { this.justSwiped = false; }, 0);
  }

  private set(x: number) {
    this.x = x;
    this.el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
    const commitAt = Math.min(this.el.offsetWidth * COMMIT_RATIO, COMMIT_MAX);
    this.el.parentElement?.style.setProperty('--swipe-progress', String(Math.max(0, Math.min(1, x / commitAt))));
  }

  ngOnDestroy() {
    this.stopSpring?.();
  }
}
