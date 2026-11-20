import * as THREE from 'three';
import { absoluteCells } from '../core/board';
import { PIECE_KINDS, type ActivePiece, type PieceKind } from '../core/types';
import { cellToWorld } from './coords';
import { blockTexture } from './textures';

/** Semi-transparent landing preview of the active piece (REQ-V3). */
export class GhostLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly materials = new Map<PieceKind, THREE.MeshLambertMaterial>();
  private readonly m = new THREE.Matrix4();

  constructor(private readonly width: number) {
    for (const k of PIECE_KINDS) {
      this.materials.set(
        k,
        new THREE.MeshLambertMaterial({
          map: blockTexture(k),
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
    }
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.94, 0.94, 0.94),
      this.materials.get('I') as THREE.Material,
      4,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  sync(active: ActivePiece | null, ghost: ActivePiece | null): void {
    if (!active || !ghost || ghost.pos.y === active.pos.y) {
      this.mesh.count = 0;
      return;
    }
    this.mesh.material = this.materials.get(ghost.kind) as THREE.Material;
    absoluteCells(ghost).forEach((c, i) => {
      const [x, y, z] = cellToWorld(c.x, c.y, this.width);
      this.m.makeTranslation(x, y, z);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.count = 4;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
