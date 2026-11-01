import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { AppStore } from '../../core/app-store';
import { Api, errorMessage } from '../../core/api.service';
import { DailyDay, DailyMonth, DailySlot } from '../../core/models';
import { FULL_MONTHS, MONTHS, fmtInput, inr, lastDay, parseNum, ymMonth0, ymYear } from '../../core/utils/format';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { YmPipe } from '../../shared/pipes/ym.pipe';
import { Icon } from '../../shared/ui/icon/icon';

/** The fixed slots of a day, in the order they happen. */
const SLOTS: { key: DailySlot; label: string; emoji: string }[] = [
  { key: 'teaMorning', label: 'Morning tea', emoji: '☕' },
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🍛' },
  { key: 'snacks', label: 'Snacks', emoji: '🍪' },
  { key: 'teaEvening', label: 'Evening tea', emoji: '🫖' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SAVE_DELAY_MS = 600; // save a moment after the last change

/** Short amount for small calendar cells on phones: ₹330, ₹1.2k, ₹45k, ₹1.5L. */
const shortInr = (n: number) => '₹' + (n < 1000 ? String(n) : n < 100000 ? `${+(n / 1000).toFixed(n < 10000 ? 1 : 0)}k` : `${+(n / 100000).toFixed(1)}L`);

interface Draft { slots: Record<DailySlot, string>; others: { name: string; amount: string }[]; }

const emptyDraft = (): Draft => ({ slots: { teaMorning: '', breakfast: '', lunch: '', snacks: '', teaEvening: '', dinner: '' }, others: [] });
const draftOf = (d: DailyDay | undefined): Draft => (d
  ? { slots: Object.fromEntries(SLOTS.map((s) => [s.key, fmtInput(d[s.key])])) as Draft['slots'], others: d.others.map((o) => ({ name: o.name, amount: fmtInput(o.amount) })) }
  : emptyDraft());
const draftTotal = (d: Draft) => SLOTS.reduce((s, x) => s + parseNum(d.slots[x.key]), 0) + d.others.reduce((s, o) => s + parseNum(o.amount), 0);
/** "Wednesday, 28 Oct" */
const longDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}`;
};

/**
 * Daily spends: tea, meals, snacks and other small spends, one card per day. Today, or any earlier day
 * picked on the calendar (for days you forgot), can be filled in – it saves itself. Future days don't exist yet.
 * Just for tracking – never part of the month's budget or balance.
 */
@Component({
  selector: 'app-daily-spends',
  imports: [InrPipe, YmPipe, Icon],
  templateUrl: './daily-spends.html',
  styleUrl: './daily-spends.scss',
})
export class DailySpendsPage implements OnDestroy {
  protected store = inject(AppStore);
  private api = inject(Api);

  protected readonly slots = SLOTS;
  protected readonly weekdays = WEEKDAYS;
  protected readonly data = signal<DailyMonth | null>(null);
  protected readonly error = signal('');
  /** The day shown in the left card (null = nothing to show for this month). */
  protected readonly selected = signal<string | null>(null);
  protected readonly draft = signal<Draft>(emptyDraft());
  protected readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  private dirty = false;
  private saveTimer?: ReturnType<typeof setTimeout>;

  protected readonly ym = this.store.ym;
  protected readonly today = computed(() => this.data()?.today ?? '');
  private readonly byDate = computed(() => new Map((this.data()?.days ?? []).map((d) => [d.date, d])));
  protected readonly isCurrentMonth = computed(() => this.today().slice(0, 7) === this.ym());
  protected readonly isFutureMonth = computed(() => !!this.today() && this.ym() > this.today().slice(0, 7));
  /** The picked day can be filled in: today or any earlier day. */
  protected readonly editing = computed(() => !!this.today() && !!this.selected() && this.selected()! <= this.today());
  protected readonly isToday = computed(() => !!this.today() && this.selected() === this.today());
  protected readonly selectedLabel = computed(() => (this.selected() ? longDay(this.selected()!) : ''));
  protected readonly draftTotal = computed(() => draftTotal(this.draft()));

  // ---- the numbers at the top ----
  /** A day's total – for the day being filled in, what's being typed, so every figure moves as you enter. */
  private totalOf(date: string) {
    return this.editing() && date === this.selected() ? this.draftTotal() : this.byDate().get(date)?.total ?? 0;
  }
  protected readonly monthTotal = computed(() => {
    const d = this.data();
    if (!d) return 0;
    const sel = this.selected();
    const live = this.editing() && sel?.slice(0, 7) === d.ym ? this.draftTotal() - (this.byDate().get(sel!)?.total ?? 0) : 0;
    return d.monthTotal + live;
  });
  protected readonly todayTotal = computed(() => (this.isCurrentMonth() ? this.totalOf(this.today()) : 0));
  /** Days that have passed in this month (all of them for an earlier month). */
  private readonly daysSoFar = computed(() => (this.isFutureMonth() ? 0 : this.isCurrentMonth() ? Number(this.today().slice(8, 10)) : lastDay(this.ym())));
  protected readonly average = computed(() => (this.daysSoFar() ? Math.round(this.monthTotal() / this.daysSoFar()) : 0));
  protected readonly highest = computed(() => {
    const days = (this.data()?.days ?? []).map((d) => ({ date: d.date, total: this.totalOf(d.date) }));
    const sel = this.selected();
    if (this.editing() && sel?.slice(0, 7) === this.ym() && !this.byDate().has(sel)) days.push({ date: sel, total: this.draftTotal() });
    return days.reduce<{ date: string; total: number } | null>((best, d) => (d.total > (best?.total ?? 0) ? d : best), null);
  });
  protected readonly highestLabel = computed(() => (this.highest() ? longDay(this.highest()!.date) : ''));

  // ---- calendar ----
  protected readonly monthName = computed(() => `${FULL_MONTHS[ymMonth0(this.ym())]} ${ymYear(this.ym())}`);
  protected readonly cells = computed(() => {
    const ym = this.ym(), today = this.today(), sel = this.selected();
    const offset = (new Date(ymYear(ym), ymMonth0(ym), 1).getDay() + 6) % 7; // Monday first
    const totals = (this.data()?.days ?? []).map((d) => this.totalOf(d.date));
    const max = Math.max(1, this.editing() ? this.draftTotal() : 0, ...totals);
    const blanks = Array.from({ length: offset }, () => null);
    const days = Array.from({ length: lastDay(ym) }, (_, i) => {
      const date = `${ym}-${String(i + 1).padStart(2, '0')}`;
      const total = this.totalOf(date);
      const future = !today || date > today;
      return {
        date, day: i + 1, total, short: shortInr(total), future, isToday: date === today, selected: date === sel,
        level: future || !total ? 0 : Math.min(4, Math.ceil((total / max) * 4)), // shade by how much was spent
        label: `${i + 1} ${MONTHS[ymMonth0(ym)]}${future ? ', not yet' : total ? ', ' + inr(total) : ', nothing logged'}`,
      };
    });
    return [...blanks, ...days];
  });

  constructor() {
    // Load the month (again after any change elsewhere, e.g. another tab).
    effect(async () => {
      const ym = this.ym();
      this.store.version();
      try {
        const d = await this.api.dailyMonth(ym);
        if (ym !== this.ym()) return;
        this.data.set(d);
        this.error.set('');
        untracked(() => this.pickDefaultDay());
      } catch (e) {
        this.error.set(errorMessage(e));
      }
    });
  }

  /** Today in this month; otherwise the last day with spends; keeps the current choice if it's still in view. */
  private pickDefaultDay() {
    const d = this.data()!, sel = this.selected();
    if (sel && sel.slice(0, 7) === d.ym && sel <= d.today) {
      if (!this.dirty) this.draft.set(draftOf(this.byDate().get(sel)));
      return;
    }
    const pick = d.today.slice(0, 7) === d.ym ? d.today : d.days.at(-1)?.date ?? null;
    this.select(pick);
  }

  protected select(date: string | null) {
    if (date && this.today() && date > this.today()) return; // no future days
    this.flush();
    this.selected.set(date);
    this.saveState.set('idle');
    if (date) this.draft.set(draftOf(this.byDate().get(date)));
  }

  /** From the calendar: show that day, bringing its card into view when the calendar sits below it (phones). */
  protected pick(date: string) {
    this.select(date);
    const card = document.querySelector<HTMLElement>('.day');
    if (card && card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  protected goToToday() {
    if (this.ym() !== this.today().slice(0, 7)) this.store.ym.set(this.today().slice(0, 7));
    this.select(this.today());
  }

  // ---- entering a day's spends (saves itself) ----
  protected setSlot(key: DailySlot, value: string) {
    this.draft.update((d) => ({ ...d, slots: { ...d.slots, [key]: value } }));
    this.changed();
  }
  protected setOther(i: number, field: 'name' | 'amount', value: string) {
    this.draft.update((d) => ({ ...d, others: d.others.map((o, j) => (j === i ? { ...o, [field]: value } : o)) }));
    this.changed();
  }
  protected addOther() {
    this.draft.update((d) => ({ ...d, others: [...d.others, { name: '', amount: '' }] }));
    setTimeout(() => document.querySelectorAll<HTMLInputElement>('.other-name').item(this.draft().others.length - 1)?.focus());
  }
  protected removeOther(i: number) {
    this.draft.update((d) => ({ ...d, others: d.others.filter((_, j) => j !== i) }));
    this.changed();
  }
  /** Amount boxes take digits only (letters and symbols are dropped as you type). */
  protected digits(e: Event): string {
    const el = e.target as HTMLInputElement;
    const v = el.value.replace(/[^0-9]/g, '');
    if (v !== el.value) el.value = v;
    return v;
  }

  /** Shows the amount with Indian commas once you leave the field. */
  protected tidy(e: Event) {
    const el = e.target as HTMLInputElement;
    el.value = fmtInput(parseNum(el.value));
  }

  private changed() {
    this.dirty = true;
    this.saveState.set('idle');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  /** Saves straight away if there's anything waiting (e.g. before switching day). */
  private flush() {
    if (!this.dirty) return;
    clearTimeout(this.saveTimer);
    this.save();
  }

  private async save() {
    const date = this.selected(), d = this.draft();
    if (!date || !this.today() || date > this.today()) return;
    this.dirty = false;
    this.saveState.set('saving');
    const body = {
      ...Object.fromEntries(SLOTS.map((s) => [s.key, parseNum(d.slots[s.key])])),
      others: d.others.filter((o) => o.name.trim() || parseNum(o.amount)).map((o) => ({ name: o.name.trim(), amount: parseNum(o.amount) })),
    };
    try {
      const saved = await this.api.saveDaily(date, body);
      this.data.update((m) => {
        if (!m || m.ym !== date.slice(0, 7)) return m;
        const days = m.days.filter((x) => x.date !== date);
        if (saved.total || saved.others.length) days.push(saved);
        days.sort((a, b) => a.date.localeCompare(b.date));
        return { ...m, days, monthTotal: days.reduce((s, x) => s + x.total, 0) };
      });
      if (!this.dirty) this.saveState.set('saved');
    } catch (e) {
      this.dirty = true;
      this.saveState.set('error');
      this.error.set(errorMessage(e));
    }
  }

  ngOnDestroy() { this.flush(); }
}
