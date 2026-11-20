import type { Action, StepInput } from '../core/types';
import { AutoRepeat } from './autorepeat';

export type Command = Action | 'camera' | 'mute';

/**
 * Collects keyboard/touch presses into per-frame StepInput.
 * Left/right go through our own DAS/ARR; soft drop is a held flag.
 */
export class Controller {
  private readonly auto = new AutoRepeat();
  private readonly queue: Action[] = [];
  private soft = false;
  private readonly held = new Set<Command>();

  constructor(private readonly onCommand: (c: 'camera' | 'mute') => void = () => {}) {}

  press(c: Command): void {
    if (this.held.has(c)) return; // ignore OS/browser auto-repeat
    this.held.add(c);
    switch (c) {
      case 'left':
      case 'right':
        this.queue.push(...this.auto.press(c));
        break;
      case 'softDrop':
        this.soft = true;
        break;
      case 'camera':
      case 'mute':
        this.onCommand(c);
        break;
      default:
        this.queue.push(c);
    }
  }

  release(c: Command): void {
    this.held.delete(c);
    if (c === 'left' || c === 'right') this.auto.release(c);
    if (c === 'softDrop') this.soft = false;
  }

  releaseAll(): void {
    this.held.clear();
    this.auto.releaseAll();
    this.soft = false;
    this.queue.length = 0;
  }

  poll(frameDtMs: number): StepInput {
    const actions: Action[] = [...this.queue, ...this.auto.update(frameDtMs)];
    this.queue.length = 0;
    return { actions, softDrop: this.soft };
  }
}
