import * as THREE from 'three';
import { BOARD_WIDTH, VISIBLE_ROWS } from '../config';
import { mulberry32 } from '../core/rng';
import { blockTexture, type MaterialId } from './textures';
import { cellToWorld } from './coords';

const box = new THREE.BoxGeometry(1, 1, 1);

export function blockMaterial(id: MaterialId): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map: blockTexture(id) });
}

function instanced(
  id: MaterialId,
  positions: Array<[number, number, number]>,
  opts: { cast?: boolean; receive?: boolean; scale?: [number, number, number] } = {},
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(box, blockMaterial(id), Math.max(1, positions.length));
  const m = new THREE.Matrix4();
  const [sx, sy, sz] = opts.scale ?? [1, 1, 1];
  positions.forEach(([x, y, z], i) => {
    m.makeScale(sx, sy, sz).setPosition(x, y, z);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = positions.length;
  mesh.castShadow = opts.cast ?? false;
  mesh.receiveShadow = opts.receive ?? true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Stone frame, faint back grid and a decorative block landscape (REQ-V4). */
export class Well {
  readonly group = new THREE.Group();
  private readonly clouds = new THREE.Group();

  constructor(width = BOARD_WIDTH, rows = VISIBLE_ROWS) {
    this.group.add(this.buildFrame(width, rows));
    this.group.add(this.buildBackWall(width, rows));
    this.group.add(...this.buildGround(width));
    this.group.add(...this.buildTrees());
    this.buildClouds();
    this.group.add(this.clouds);
  }

  private buildFrame(width: number, rows: number): THREE.InstancedMesh {
    const cells: Array<[number, number, number]> = [];
    for (let y = -1; y < rows; y++) {
      cells.push(cellToWorld(-1, y, width), cellToWorld(width, y, width));
    }
    for (let x = 0; x < width; x++) cells.push(cellToWorld(x, -1, width));
    // Frame blocks get pushed back a touch less than full depth so the well reads as a channel.
    return instanced('frame', cells, { cast: true, receive: true });
  }

  private buildBackWall(width: number, rows: number): THREE.Group {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, rows),
      new THREE.MeshLambertMaterial({ color: 0x1b2230, transparent: true, opacity: 0.72 }),
    );
    wall.position.set(0, rows / 2, -0.51);
    wall.receiveShadow = true;
    g.add(wall);

    const pts: number[] = [];
    const half = width / 2;
    for (let x = 0; x <= width; x++) pts.push(x - half, 0, -0.5, x - half, rows, -0.5);
    for (let y = 0; y <= rows; y++) pts.push(-half, y, -0.5, half, y, -0.5);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x9fb4d6, transparent: true, opacity: 0.16 }),
    );
    g.add(lines);
    return g;
  }

  private buildGround(width: number): THREE.InstancedMesh[] {
    const rng = mulberry32(2026);
    const buckets: Record<'ground' | 'groundAlt' | 'S', Array<[number, number, number]>> = {
      ground: [],
      groundAlt: [],
      S: [],
    };
    const half = Math.ceil(width / 2) + 1;
    for (let x = -26; x <= 26; x++) {
      for (let z = -22; z <= 14; z++) {
        const r = rng();
        const nearPath = Math.abs(z - 4) <= 1;
        const id = nearPath ? 'groundAlt' : r < 0.55 ? 'S' : r < 0.85 ? 'ground' : 'groundAlt';
        const bump = !nearPath && r > 0.97 && Math.abs(x) > half + 2 ? 1 : 0;
        buckets[id].push([x, -1.5 + bump, z]);
      }
    }
    return [
      instanced('ground', buckets.ground),
      instanced('groundAlt', buckets.groundAlt),
      instanced('S', buckets.S),
    ];
  }

  private buildTrees(): THREE.InstancedMesh[] {
    const trunks: Array<[number, number, number]> = [];
    const leaves: Array<[number, number, number]> = [];
    const spots: Array<[number, number, number]> = [
      [-15, -8, 4],
      [-21, -14, 5],
      [16, -10, 4],
      [22, -4, 5],
      [-12, -18, 5],
      [12, -19, 6],
    ];
    for (const [x, z, h] of spots) {
      for (let y = 0; y < h; y++) trunks.push([x, -0.5 + y, z]);
      const top = -0.5 + h;
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (let dy = 0; dy <= 1; dy++) leaves.push([x + dx, top + dy, z + dz]);
      leaves.push([x, top + 2, z]);
    }
    return [instanced('wood', trunks, { cast: true }), instanced('S', leaves, { cast: true })];
  }

  private buildClouds(): void {
    const rng = mulberry32(77);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const parts = 2 + Math.floor(rng() * 3);
      for (let p = 0; p < parts; p++) {
        const m = new THREE.Mesh(box, mat);
        m.scale.set(4 + rng() * 6, 1.2, 3 + rng() * 4);
        m.position.set(p * 3 - parts, rng() * 0.6, (rng() - 0.5) * 3);
        cloud.add(m);
      }
      cloud.position.set(-60 + rng() * 120, 26 + rng() * 10, -50 - rng() * 30);
      cloud.userData.speed = 0.4 + rng() * 0.6;
      this.clouds.add(cloud);
    }
  }

  /** Slow cloud drift; purely decorative. */
  update(dtMs: number, reducedMotion: boolean): void {
    if (reducedMotion) return;
    for (const c of this.clouds.children) {
      c.position.x += ((c.userData.speed as number) * dtMs) / 1000;
      if (c.position.x > 70) c.position.x = -70;
    }
  }
}
