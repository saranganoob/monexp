import { Component, computed, input } from '@angular/core';

const PATHS = {
  overview: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  checklist: 'M9 5h11M9 12h11M9 19h11M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  'calendar-check': 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4M9 15l2 2 4-4',
  calendar: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4',
  people: 'M16 19c0-2.2-1.8-4-4-4H6c-2.2 0-4 1.8-4 4M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19c0-2-1.3-3.6-3-4M16 5.5a3 3 0 0 1 0 5.6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  'sign-out': 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z',
  sparkle: 'M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z',
  sparkles: 'M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8zM19 15l.8 2 2 .8-2 .8L19 21l-.8-2.4-2-.8 2-.8z',
  send: 'M5 12h14M13 6l6 6-6 6',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  sun: 'M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  'collapse-left': 'M11 6l-6 6 6 6M19 6l-6 6 6 6',
  'expand-right': 'M13 6l6 6-6 6M5 6l6 6-6 6',
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7',
  'sidebar-left': 'M3 4h18v16H3zM9 4v16',
} as const;

export type IconName = keyof typeof PATHS;

/** <app-icon name="edit" /> – stroke icons from the design, sized in px. */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly stroke = input(2);
  protected readonly path = computed(() => PATHS[this.name()]);
}
