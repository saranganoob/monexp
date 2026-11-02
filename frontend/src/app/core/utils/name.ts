// The name shown for a login: the one they typed in Profile → Account, else taken from the email
// ("sarangan.e@…" → "Sarangan E"), else "Me" (mobile-number-only logins).

interface Named { name?: string; email?: string; phone?: string; }

export function displayName(a: Named | null | undefined): string {
  const typed = a?.name?.trim();
  if (typed) return typed;
  const local = a?.email?.split('@')[0] ?? '';
  const words = local.replace(/[0-9]+/g, ' ').split(/[._\-+\s]+/).filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Me';
}

/** First word only: "Sarangan E" → "Sarangan". */
export const firstName = (full: string) => full.split(' ')[0];

/** Up to two letters: "Sarangan E" → "SE", "Arun" → "A". */
export function initials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0) : parts[0]?.charAt(0) ?? '?';
  return letters.toUpperCase();
}
