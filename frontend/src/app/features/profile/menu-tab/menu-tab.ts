import { Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '../../../core/theme.service';
import { DEFAULT_MENU_ORDER, MenuKey, OVERVIEW_ITEM, menuItem } from '../../../core/nav';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Profile → Menu (computer only): drag the sections into any order and switch off the ones you don't use.
 * Saved to the account, so the phone's bottom bar follows the same order. Hiding never touches any data.
 */
@Component({
  selector: 'app-menu-tab',
  imports: [Icon],
  templateUrl: './menu-tab.html',
  styleUrl: './menu-tab.scss',
})
export class MenuTab {
  protected theme = inject(ThemeService);
  protected readonly overview = OVERVIEW_ITEM;
  protected readonly rows = computed(() => {
    const hidden = this.theme.navHidden();
    return this.theme.navOrder().map((key) => ({ ...menuItem(key), on: !hidden.includes(key) }));
  });
  /** What the menu will look like (Overview + the sections switched on). */
  protected readonly preview = computed(() => [this.overview, ...this.rows().filter((r) => r.on)]);
  protected readonly isDefault = computed(() =>
    !this.theme.navHidden().length && this.theme.navOrder().every((k, i) => k === DEFAULT_MENU_ORDER[i]));
  protected readonly saved = signal(false);
  /** Announced to screen readers after a move. */
  protected readonly said = signal('');

  // ---- dragging (mouse; only the ⋮⋮ handle starts a drag) ----
  protected readonly dragging = signal<MenuKey | null>(null);
  private armed: MenuKey | null = null;
  private savedTimer?: ReturnType<typeof setTimeout>;

  protected arm(key: MenuKey) { this.armed = key; }
  protected disarm() { this.armed = null; }

  protected dragStart(e: DragEvent, key: MenuKey) {
    if (this.armed !== key) { e.preventDefault(); return; }
    this.dragging.set(key);
    e.dataTransfer?.setData('text/plain', key);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  /** While dragging over another row, the dragged one takes its place – the rest slide along. */
  protected dragOver(e: DragEvent, over: MenuKey) {
    const key = this.dragging();
    if (!key) return;
    e.preventDefault();
    if (key === over) return;
    const order = this.theme.navOrder().filter((k) => k !== key);
    order.splice(this.theme.navOrder().indexOf(over), 0, key);
    this.apply(order, this.theme.navHidden(), false);
  }

  protected dragEnd() {
    if (!this.dragging()) return;
    this.dragging.set(null);
    this.armed = null;
    this.apply(this.theme.navOrder(), this.theme.navHidden());
  }

  // ---- buttons ----
  protected move(key: MenuKey, by: -1 | 1) {
    const order = [...this.theme.navOrder()];
    const i = order.indexOf(key), j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.apply(order, this.theme.navHidden());
    this.said.set(`${menuItem(key).label} moved to position ${j + 2}`); // Overview is position 1
  }

  protected toggle(key: MenuKey) {
    const hidden = this.theme.navHidden();
    this.apply(this.theme.navOrder(), hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
  }

  protected reset() { this.apply([...DEFAULT_MENU_ORDER], []); }

  /** Shows the change at once; `save` false while still dragging (saved when the drag ends). */
  private apply(order: MenuKey[], hidden: MenuKey[], save = true) {
    if (!save) { this.theme.navOrder.set(order); return; }
    this.theme.setMenu(order, hidden);
    this.saved.set(true);
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.saved.set(false), 1800);
  }
}
