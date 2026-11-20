import type { Rng } from './rng';
import { PIECE_KINDS, type PieceKind } from './types';

/** 7-bag generator: every batch of 7 contains each shape exactly once, shuffled. */
export class Bag {
  private pending: PieceKind[] = [];

  constructor(private readonly rng: Rng) {}

  next(): PieceKind {
    if (this.pending.length === 0) this.refill();
    return this.pending.shift() as PieceKind;
  }

  private refill(): void {
    const batch: PieceKind[] = [...PIECE_KINDS];
    for (let i = batch.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = batch[i] as PieceKind;
      batch[i] = batch[j] as PieceKind;
      batch[j] = tmp;
    }
    this.pending = batch;
  }
}
