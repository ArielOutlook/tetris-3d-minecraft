import { BOARD_WIDTH } from '../config';

/** Board cell → world position (cube center). Well floor sits at world y = 0. */
export function cellToWorld(x: number, y: number, width = BOARD_WIDTH): [number, number, number] {
  return [x - width / 2 + 0.5, y + 0.5, 0];
}
