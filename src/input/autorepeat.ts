import { ARR_MS, DAS_MS } from '../config';

export type Direction = 'left' | 'right';

/**
 * Pure delayed auto-shift (DAS) / auto-repeat rate (ARR) for horizontal movement.
 * Independent from the OS key repeat: callers feed press/release + elapsed time.
 * The most recently pressed direction wins; releasing it falls back to the other if still held.
 */
export class AutoRepeat {
  private held: Record<Direction, boolean> = { left: false, right: false };
  private dir: Direction | null = null;
  private timer = 0;
  private charged = false;

  constructor(
    private readonly das = DAS_MS,
    private readonly arr = ARR_MS,
    private readonly maxPerUpdate = 20,
  ) {}

  /** Returns the immediate move produced by the press (none if already held). */
  press(d: Direction): Direction[] {
    if (this.held[d]) return [];
    this.held[d] = true;
    this.activate(d);
    return [d];
  }

  release(d: Direction): void {
    this.held[d] = false;
    if (this.dir !== d) return;
    const other: Direction = d === 'left' ? 'right' : 'left';
    if (this.held[other]) this.activate(other);
    else this.dir = null;
  }

  releaseAll(): void {
    this.held = { left: false, right: false };
    this.dir = null;
  }

  get active(): Direction | null {
    return this.dir;
  }

  update(dtMs: number): Direction[] {
    const d = this.dir;
    if (!d) return [];
    const out: Direction[] = [];
    this.timer += dtMs;
    if (!this.charged) {
      if (this.timer < this.das) return out;
      this.charged = true;
      this.timer -= this.das;
      out.push(d);
    }
    while (this.timer >= this.arr && out.length < this.maxPerUpdate) {
      this.timer -= this.arr;
      out.push(d);
    }
    if (out.length >= this.maxPerUpdate) this.timer = 0;
    return out;
  }

  private activate(d: Direction): void {
    this.dir = d;
    this.timer = 0;
    this.charged = false;
  }
}
