import { IconName } from '../shared/ui/icon/icon';

/** The menu sections a person can reorder or hide (Profile → Menu). Overview always comes first. */
export type MenuKey = 'pay' | 'cards' | 'installments' | 'people' | 'sudden' | 'daily' | 'year';

/** `short` = the name under the icon in the phone bottom bar. */
export interface MenuItem { key: MenuKey | 'overview' | 'admin'; path: string; label: string; short: string; icon: IconName; exact?: boolean; badge?: boolean; }

export const OVERVIEW_ITEM: MenuItem = { key: 'overview', path: '/', label: 'Overview', short: 'Home', icon: 'overview', exact: true };
export const ADMIN_ITEM: MenuItem = { key: 'admin', path: '/admin', label: 'Admin', short: 'Admin', icon: 'shield' };

/** In the default order. */
export const MENU_ITEMS: (MenuItem & { key: MenuKey })[] = [
  { key: 'pay', path: '/pay', label: 'Need to pay', short: 'To pay', icon: 'checklist', badge: true },
  { key: 'cards', path: '/cards', label: 'Credit cards', short: 'Cards', icon: 'card' },
  { key: 'installments', path: '/installments', label: 'Installments', short: 'EMIs', icon: 'calendar-check' },
  { key: 'people', path: '/people', label: 'People', short: 'People', icon: 'people' },
  { key: 'sudden', path: '/sudden', label: 'Sudden spends', short: 'Sudden', icon: 'bolt' },
  { key: 'daily', path: '/daily', label: 'Daily spends', short: 'Daily', icon: 'cup' },
  { key: 'year', path: '/year', label: 'Year view', short: 'Year', icon: 'chart' },
];
export const DEFAULT_MENU_ORDER: MenuKey[] = MENU_ITEMS.map((m) => m.key);

/** A saved order, made safe: unknown sections dropped, any missing ones (e.g. added later) put at the end. */
export function menuOrder(saved: readonly string[] | null | undefined): MenuKey[] {
  const known = (saved ?? []).filter((k): k is MenuKey => DEFAULT_MENU_ORDER.includes(k as MenuKey));
  const unique = [...new Set(known)];
  return [...unique, ...DEFAULT_MENU_ORDER.filter((k) => !unique.includes(k))];
}

export const menuItem = (key: MenuKey) => MENU_ITEMS.find((m) => m.key === key)!;
