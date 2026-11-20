import { MAX_FRAME_MS, STEP_MS } from '../config';

/** Fixed-timestep accumulator: converts variable frame deltas into N constant steps. */
export class FixedStepper {
  private acc = 0;

  constructor(
    private readonly stepMs = STEP_MS,
    private readonly maxFrameMs = MAX_FRAME_MS,
  ) {}

  /** Returns how many fixed steps to run for this frame. */
  advance(frameDtMs: number): number {
    this.acc += Math.max(0, Math.min(frameDtMs, this.maxFrameMs));
    let steps = 0;
    // Small epsilon absorbs float error so 1000/120 sums stay exact.
    while (this.acc + 1e-9 >= this.stepMs) {
      this.acc -= this.stepMs;
      steps++;
    }
    return steps;
  }

  get step(): number {
    return this.stepMs;
  }

  reset(): void {
    this.acc = 0;
  }
}
