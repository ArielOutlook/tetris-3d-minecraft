import type { GameEvent } from '../core/types';

type Wave = OscillatorType;

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  wave?: Wave;
  gain?: number;
  delay?: number;
}

/** Synthesized sound effects (WebAudio, no audio files). The context starts on first user gesture. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor(public muted = false) {}

  /** Must be called from a user gesture handler (autoplay policies). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private tone(t: Tone): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const start = ctx.currentTime + (t.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = t.wave ?? 'square';
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(t.gain ?? 0.5, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }

  play(events: readonly GameEvent[]): void {
    if (this.muted || !this.ctx) return;
    for (const e of events) {
      switch (e.type) {
        case 'moved':
          this.tone({ freq: 220, dur: 0.03, wave: 'square', gain: 0.12 });
          break;
        case 'rotated':
          this.tone({ freq: 440, to: 520, dur: 0.05, wave: 'triangle', gain: 0.25 });
          break;
        case 'held':
          this.tone({ freq: 330, to: 660, dur: 0.08, wave: 'triangle', gain: 0.25 });
          break;
        case 'hardDropped':
          this.tone({ freq: 180, to: 60, dur: 0.12, wave: 'sawtooth', gain: 0.3 });
          break;
        case 'locked':
          this.tone({ freq: 110, to: 80, dur: 0.07, wave: 'square', gain: 0.25 });
          break;
        case 'linesCleared':
          if (e.count === 4) {
            [523, 659, 784, 1047].forEach((f, i) =>
              this.tone({ freq: f, dur: 0.16, wave: 'square', gain: 0.3, delay: i * 0.07 }),
            );
          } else {
            this.tone({ freq: 392 + e.count * 60, to: 784, dur: 0.18, wave: 'triangle', gain: 0.4 });
          }
          break;
        case 'levelUp':
          [392, 523, 659].forEach((f, i) =>
            this.tone({ freq: f, dur: 0.12, wave: 'triangle', gain: 0.3, delay: 0.25 + i * 0.09 }),
          );
          break;
        case 'gameOver':
          [392, 330, 262, 196].forEach((f, i) =>
            this.tone({ freq: f, dur: 0.22, wave: 'square', gain: 0.3, delay: i * 0.16 }),
          );
          break;
        default:
          break;
      }
    }
  }
}
