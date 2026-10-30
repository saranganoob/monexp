// Works out a typed sum like "23+22", "1500*3-200", "(500+250)*2" or "2500*18%".
// A tiny parser – what's typed is never run as code.
// × x * multiply, ÷ / divide, n% = n ÷ 100. Returns null when the sum isn't complete or valid.

/** Characters allowed in the calculator box. */
export const CALC_CHARS = /[0-9+\-*/xX×÷%.() ]/;

export function evaluate(input: string): number | null {
  const src = input.replace(/[xX×]/g, '*').replace(/÷/g, '/').replace(/,/g, '').replace(/\s+/g, '').replace(/=+$/, '');
  if (!src) return null;
  let i = 0;
  const peek = () => src[i];

  const number = (): number => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) throw new Error('number expected');
    i += m[0].length;
    return parseFloat(m[0]);
  };
  // factor = -factor | (expr) | number, optionally followed by %
  const factor = (): number => {
    if (peek() === '-') { i++; return -factor(); }
    if (peek() === '+') { i++; return factor(); }
    let v: number;
    if (peek() === '(') {
      i++;
      v = expr();
      if (peek() !== ')') throw new Error(') expected');
      i++;
    } else {
      v = number();
    }
    while (peek() === '%') { i++; v /= 100; }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = src[i++];
      const r = factor();
      if (op === '/' && r === 0) throw new Error('divide by zero');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  try {
    const v = expr();
    if (i !== src.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100; // money: at most 2 decimals
  } catch {
    return null;
  }
}

/** 4300 → "4,300", 12.5 → "12.5" (Indian grouping). */
export const calcLabel = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
