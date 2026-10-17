// A tiny spring animator for gesture-driven motion (no library needed).
// Apple-style parameters: damping ratio (1 = no bounce, < 1 = bounce) and response (seconds,
// roughly how quickly it gets there). It starts from the current value and velocity, so a
// moving element can be grabbed again and redirected at any moment.

export interface SpringOptions {
  damping?: number;
  response?: number;
  /** Starting speed in px/s – hand over the finger's speed so there's no seam after release. */
  velocity?: number;
}

/** Animates `from` → `to`, calling `onUpdate` each frame. Returns a function that stops it where it is. */
export function springTo(from: number, to: number, opts: SpringOptions, onUpdate: (x: number) => void, onDone?: () => void): () => void {
  const damping = opts.damping ?? 1;
  const response = opts.response ?? 0.35;
  const stiffness = (2 * Math.PI / response) ** 2; // mass = 1
  const friction = (4 * Math.PI * damping) / response;
  let x = from;
  let v = opts.velocity ?? 0;
  let last = performance.now();
  let frame = 0;

  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    // a few small steps per frame keep the physics stable
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      v += (-stiffness * (x - to) - friction * v) * h;
      x += v * h;
    }
    if (Math.abs(x - to) < 0.5 && Math.abs(v) < 10) {
      onUpdate(to);
      onDone?.();
      return;
    }
    onUpdate(x);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Where a flick would come to rest (Apple's scroll-deceleration projection, rate ≈ 0.998). */
export const projectMomentum = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

/** Soft resistance past an edge: the further you pull, the less it follows. */
export const rubberband = (overshoot: number, dimension: number, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
