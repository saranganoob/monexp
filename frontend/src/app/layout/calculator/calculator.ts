import { Component, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { CALC_CHARS, calcLabel, evaluate } from '../../core/utils/calc';
import { Icon } from '../../shared/ui/icon/icon';

const POS_KEY = 'monexp.calc.pos';
const HISTORY_KEY = 'monexp.calc.history';
const EDGE = 8; // keep at least this much of a gap from the window's edges

interface Pos { x: number; y: number; }
interface Line { sum: string; result: number; }

function readJson<T>(store: Storage | undefined, key: string): T | null {
  try { return JSON.parse(store?.getItem(key) || 'null') as T | null; } catch { return null; }
}
function writeJson(store: Storage | undefined, key: string, value: unknown) {
  try { store?.setItem(key, JSON.stringify(value)); } catch { /* storage blocked – fine for this visit */ }
}

/**
 * A floating calculator (web only). Type a sum like 23+22 and press = or Enter, or use the keys.
 * Drag it by its top bar anywhere on screen; double-click the bar to send it back to the corner.
 * Copy gives the plain number (4300, not ₹4,300) so it pastes into any amount box.
 */
@Component({
  selector: 'app-calculator',
  imports: [Icon],
  templateUrl: './calculator.html',
  styleUrl: './calculator.scss',
  host: { '(window:resize)': 'keepOnScreen()' },
})
export class Calculator {
  protected store = inject(AppStore);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private input = viewChild.required<ElementRef<HTMLInputElement>>('sumInput');
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly sum = signal('');
  /** The last answer (after = or Enter). */
  protected readonly result = signal<number | null>(null);
  /** Live answer while typing. */
  protected readonly preview = computed(() => {
    const s = this.sum();
    return /[+\-*/xX×÷%]/.test(s.replace(/^-/, '')) ? evaluate(s) : null;
  });
  protected readonly invalid = signal(false);
  protected readonly copied = signal(false);
  protected readonly history = signal<Line[]>(readJson<Line[]>(sessionStorage, HISTORY_KEY) ?? []);
  /** null = the default spot (bottom right). */
  protected readonly pos = signal<Pos | null>(readJson<Pos>(localStorage, POS_KEY));
  protected readonly dragging = signal(false);
  protected readonly label = calcLabel;

  protected readonly keys = [
    ['C', '(', ')', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['%', '0', '.', '='],
  ];

  private copyTimer?: ReturnType<typeof setTimeout>;
  private drag?: { dx: number; dy: number };

  constructor() {
    afterNextRender(() => {
      this.keepOnScreen();
      this.input().nativeElement.focus();
    });
  }

  // ---- typing ----
  protected onInput(el: HTMLInputElement) {
    const typedEquals = el.value.includes('=');
    const clean = [...el.value].filter((c) => CALC_CHARS.test(c)).join('');
    if (clean !== el.value) el.value = clean;
    this.sum.set(clean);
    this.invalid.set(false);
    if (typedEquals) this.equals();
  }

  protected onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); this.equals(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
  }

  protected press(k: string) {
    if (k === 'C') { this.setSum(''); this.result.set(null); }
    else if (k === '=') this.equals();
    else this.setSum(this.sum() + (k === '−' ? '-' : k));
    this.input().nativeElement.focus();
  }

  protected backspace() {
    this.setSum(this.sum().slice(0, -1));
    this.input().nativeElement.focus();
  }

  private setSum(v: string) {
    this.sum.set(v);
    this.input().nativeElement.value = v;
    this.invalid.set(false);
  }

  private equals() {
    const text = this.sum().replace(/=+$/, '');
    const v = evaluate(text);
    if (v === null) { this.invalid.set(!!text.trim()); this.setSum(text); return; }
    this.result.set(v);
    if (/[+\-*/xX×÷%]/.test(text.replace(/^-/, ''))) {
      this.history.update((h) => [{ sum: text, result: v }, ...h].slice(0, 5));
      writeJson(sessionStorage, HISTORY_KEY, this.history());
    }
    this.setSum(String(v)); // keep going from the answer
  }

  protected reuse(line: Line) {
    this.setSum(String(line.result));
    this.result.set(line.result);
    this.input().nativeElement.focus();
  }

  protected clearHistory() {
    this.history.set([]);
    writeJson(sessionStorage, HISTORY_KEY, []);
  }

  // ---- copy ----
  protected readonly copyValue = computed(() => this.preview() ?? this.result() ?? evaluate(this.sum()));

  protected async copy() {
    const v = this.copyValue();
    if (v === null) return;
    const text = String(v);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = this.copyOldWay(text); // clipboard API blocked (or not on https) – the older way still works in most browsers
    }
    if (!ok) return;
    this.copied.set(true);
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(false), 1600);
  }

  private copyOldWay(text: string): boolean {
    const doc = this.host.nativeElement.ownerDocument;
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    doc.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = doc.execCommand('copy'); } catch { /* not allowed */ }
    area.remove();
    this.input().nativeElement.focus();
    return ok;
  }

  // ---- dragging ----
  protected dragStart(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const r = this.panel().nativeElement.getBoundingClientRect();
    this.drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragging.set(true);
    e.preventDefault();
  }

  protected dragMove(e: PointerEvent) {
    if (!this.drag) return;
    this.pos.set(this.clamp({ x: e.clientX - this.drag.dx, y: e.clientY - this.drag.dy }));
  }

  protected dragEnd() {
    if (!this.drag) return;
    this.drag = undefined;
    this.dragging.set(false);
    writeJson(localStorage, POS_KEY, this.pos());
  }

  protected resetPos() {
    this.pos.set(null);
    try { localStorage.removeItem(POS_KEY); } catch { /* fine */ }
  }

  /** After a window resize (or a spot saved on a bigger screen), pull it back into view. */
  protected keepOnScreen() {
    const p = this.pos();
    if (p) this.pos.set(this.clamp(p));
  }

  private clamp(p: Pos): Pos {
    const el = this.panel().nativeElement;
    const w = this.host.nativeElement.ownerDocument.defaultView!;
    const maxX = Math.max(EDGE, w.innerWidth - el.offsetWidth - EDGE);
    const maxY = Math.max(EDGE, w.innerHeight - el.offsetHeight - EDGE);
    return { x: Math.round(Math.min(Math.max(EDGE, p.x), maxX)), y: Math.round(Math.min(Math.max(EDGE, p.y), maxY)) };
  }

  protected close() { this.store.calcOpen.set(false); }
}
