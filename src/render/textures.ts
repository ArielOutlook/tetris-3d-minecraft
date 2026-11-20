import * as THREE from 'three';
import { mulberry32, type Rng } from '../core/rng';
import type { PieceKind } from '../core/types';

/**
 * Original 16×16 pixel-art block textures, generated procedurally (no third-party images).
 * Each material = base palette + a pattern function + bevel.
 */
export type MaterialId = PieceKind | 'frame' | 'ground' | 'groundAlt' | 'wood';

const SIZE = 16;

type RGB = [number, number, number];

interface MaterialSpec {
  name: string;
  palette: RGB[]; // dark → light
  pattern: (x: number, y: number, rng: Rng) => number; // palette index (float, clamped)
}

const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

const SPECS: Record<MaterialId, MaterialSpec> = {
  // Straight piece: cyan ice with diagonal streaks.
  I: {
    name: 'Hielo',
    palette: [0x1d7f9e, 0x2fb3d3, 0x5fd6ee, 0x9becf8, 0xd9fbff].map(hex),
    pattern: (x, y, r) => {
      const streak = (x + y) % 7 === 0 || (x + y + 3) % 11 === 0 ? 1.6 : 0;
      return 1.6 + streak + (r() - 0.5) * 1.1;
    },
  },
  // Square piece: gold ingot with a highlight.
  O: {
    name: 'Oro',
    palette: [0x8a5a00, 0xc58b0d, 0xeab92a, 0xfbd955, 0xfff4b0].map(hex),
    pattern: (x, y, r) => {
      const shine = x - y > 4 && x - y < 8 && x > 3 && y < 12 ? 1.5 : 0;
      const groove = y === 8 ? -1 : 0;
      return 2 + shine + groove + (r() - 0.5) * 0.9;
    },
  },
  // T piece: amethyst facets.
  T: {
    name: 'Amatista',
    palette: [0x3e1766, 0x6a2fa3, 0x9356d1, 0xbc8cf0, 0xe8d4ff].map(hex),
    pattern: (x, y, r) => {
      const facet = (Math.abs(x - 8) + Math.abs(y - 8)) % 6;
      return 0.8 + facet * 0.55 + (r() - 0.5) * 0.8;
    },
  },
  // S piece: leafy moss.
  S: {
    name: 'Musgo',
    palette: [0x1f4d1a, 0x2f7a26, 0x46a234, 0x6cc84a, 0xa6ea7e].map(hex),
    pattern: (_x, _y, r) => {
      const v = r();
      return v > 0.85 ? 4 : v > 0.55 ? 2.6 : v > 0.2 ? 1.7 : 0.6;
    },
  },
  // Z piece: red brick courses.
  Z: {
    name: 'Ladrillo',
    palette: [0x5c1a12, 0x8f2a1c, 0xb8402b, 0xd76449, 0xc9b9a6].map(hex),
    pattern: (x, y, r) => {
      const mortarRow = y % 4 === 3;
      const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
      const mortarCol = (x + offset) % 8 === 7;
      if (mortarRow || mortarCol) return 4 - r() * 0.4;
      return 1.5 + (r() - 0.5) * 1.4;
    },
  },
  // J piece: speckled lapis.
  J: {
    name: 'Lapislázuli',
    palette: [0x0f2167, 0x1a3a9e, 0x2a58cf, 0x4f80ec, 0xe7c45a].map(hex),
    pattern: (_x, _y, r) => {
      const v = r();
      if (v > 0.93) return 4; // golden flecks
      return 0.6 + v * 2.4;
    },
  },
  // L piece: wooden planks with rings.
  L: {
    name: 'Madera',
    palette: [0x4e2e12, 0x7a4a1f, 0xa2692f, 0xc48a48, 0xe0b27a].map(hex),
    pattern: (x, y, r) => {
      const seam = y % 5 === 4 ? -1.2 : 0;
      const grain = Math.sin((x + Math.floor(y / 5) * 3) * 0.9) * 0.6;
      const knot = Math.hypot(x - 11, (y % 5) - 2) < 1.2 && Math.floor(y / 5) === 1 ? -1 : 0;
      return 2.1 + seam + grain + knot + (r() - 0.5) * 0.6;
    },
  },
  // Well frame: grey stone with cracks.
  frame: {
    name: 'Piedra',
    palette: [0x3b3d42, 0x5b5e66, 0x7b7f88, 0x9ca0a8, 0xbdc0c6].map(hex),
    pattern: (x, y, r) => {
      const crack = (x * 3 + y * 5) % 17 === 0 || (x === 4 && y > 9 && y < 14) ? -1.4 : 0;
      return 2 + crack + (r() - 0.5) * 1.6;
    },
  },
  // Decorative ground: earthy clay.
  ground: {
    name: 'Arcilla',
    palette: [0x4a3424, 0x6a4b33, 0x86603f, 0xa27a54, 0xbf9a71].map(hex),
    pattern: (_x, _y, r) => 1.2 + r() * 2.2,
  },
  // Decorative ground variant: sand.
  groundAlt: {
    name: 'Arena',
    palette: [0x9e8a5c, 0xbfa874, 0xd8c48d, 0xe8d8a6, 0xf5ecc8].map(hex),
    pattern: (x, y, r) => 1.5 + ((x * 7 + y * 3) % 5 === 0 ? 1.2 : 0) + (r() - 0.5) * 1.2,
  },
  // Decorative trees.
  wood: {
    name: 'Tronco',
    palette: [0x35210f, 0x553419, 0x734a26, 0x8f6134, 0xab7c49].map(hex),
    pattern: (x, _y, r) => 1.6 + (x % 4 === 0 ? -1 : 0) + (r() - 0.5) * 1.2,
  },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Draws the 16×16 pixel art of a material into a fresh canvas. */
export function drawMaterial(id: MaterialId, seed = 1): HTMLCanvasElement {
  const spec = SPECS[id];
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(SIZE, SIZE);
  const rng = mulberry32(seed * 977 + id.charCodeAt(0) * 31 + id.length);
  const last = spec.palette.length - 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let idx = spec.pattern(x, y, rng);
      // Bevel: light top-left edge, dark bottom-right edge.
      if (x === 0 || y === 0) idx += 1;
      if (x === SIZE - 1 || y === SIZE - 1) idx -= 1.2;
      const [r, g, b] = spec.palette[clamp(Math.round(idx), 0, last)] as RGB;
      const o = (y * SIZE + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function materialName(id: MaterialId): string {
  return SPECS[id].name;
}

/** Representative mid color, used for particles. */
export function materialColor(id: MaterialId): THREE.Color {
  const [r, g, b] = SPECS[id].palette[2] as RGB;
  return new THREE.Color(r / 255, g / 255, b / 255);
}

const cache = new Map<MaterialId, THREE.CanvasTexture>();

export function blockTexture(id: MaterialId): THREE.CanvasTexture {
  let tex = cache.get(id);
  if (!tex) {
    tex = new THREE.CanvasTexture(drawMaterial(id));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(id, tex);
  }
  return tex;
}

/** Cached data-URL per material for 2D UI previews. */
const urlCache = new Map<MaterialId, HTMLCanvasElement>();
export function materialCanvas(id: MaterialId): HTMLCanvasElement {
  let c = urlCache.get(id);
  if (!c) {
    c = drawMaterial(id);
    urlCache.set(id, c);
  }
  return c;
}
