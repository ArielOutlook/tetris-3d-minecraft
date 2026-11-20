import { pieceCells } from '../core/pieces';
import type { PieceKind } from '../core/types';
import { materialCanvas } from './textures';

/**
 * 2D pixel-art previews (next / hold) drawn with the same procedural textures.
 * Uses plain canvas 2D instead of extra WebGL viewports: crisp, cheap and one GL context.
 */
export function drawPiecePreview(
  canvas: HTMLCanvasElement,
  kinds: ReadonlyArray<PieceKind | null>,
  opts: { cell?: number; dim?: boolean } = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cell = opts.cell ?? 18;
  const slotH = cell * 3;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = cell * 5;
  const cssH = slotH * Math.max(1, kinds.length);
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = opts.dim ? 0.45 : 1;
  kinds.forEach((kind, slot) => {
    if (!kind) return;
    const cells = pieceCells(kind, 0);
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = (maxX - minX + 1) * cell;
    const h = (maxY - minY + 1) * cell;
    const ox = (cssW - w) / 2;
    const oy = slot * slotH + (slotH - h) / 2;
    const tex = materialCanvas(kind);
    for (const c of cells) {
      const px = ox + (c.x - minX) * cell;
      const py = oy + (maxY - c.y) * cell;
      // Fake depth: dark offset "side" then the textured face.
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(px + 3, py + 3, cell, cell);
      ctx.drawImage(tex, px, py, cell, cell);
    }
  });
  ctx.globalAlpha = 1;
}
