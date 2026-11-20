import * as THREE from 'three';
import { absoluteCells } from '../core/board';
import { PIECE_KINDS, type ActivePiece, type Board, type PieceKind } from '../core/types';
import { cellToWorld } from './coords';
import { blockMaterial } from './well';

const box = new THREE.BoxGeometry(1, 1, 1);

/** One InstancedMesh per piece material; rebuilt every frame (≤ 224 instances, trivially cheap). */
export class BlockLayer {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<PieceKind, THREE.InstancedMesh>();
  private readonly counts = new Map<PieceKind, number>();
  private readonly m = new THREE.Matrix4();

  constructor(
    private readonly width: number,
    height: number,
  ) {
    const capacity = width * height + 4;
    for (const kind of PIECE_KINDS) {
      const mesh = new THREE.InstancedMesh(box, blockMaterial(kind), capacity);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  private push(kind: PieceKind, x: number, y: number): void {
    const mesh = this.meshes.get(kind) as THREE.InstancedMesh;
    const i = this.counts.get(kind) ?? 0;
    const [wx, wy, wz] = cellToWorld(x, y, this.width);
    this.m.makeTranslation(wx, wy, wz);
    mesh.setMatrixAt(i, this.m);
    this.counts.set(kind, i + 1);
  }

  sync(board: Board, active: ActivePiece | null): void {
    for (const k of PIECE_KINDS) this.counts.set(k, 0);
    board.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell) this.push(cell, x, y);
      }),
    );
    if (active) for (const c of absoluteCells(active)) this.push(active.kind, c.x, c.y);
    for (const [kind, mesh] of this.meshes) {
      mesh.count = this.counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Total rendered cubes (used by the FPS overlay / tests). */
  get total(): number {
    let n = 0;
    for (const v of this.counts.values()) n += v;
    return n;
  }
}
