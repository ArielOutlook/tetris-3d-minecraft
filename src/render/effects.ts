import * as THREE from 'three';
import type { PieceKind } from '../core/types';
import { cellToWorld } from './coords';
import { materialColor } from './textures';

const FLASH_MS = 180;
const PARTICLE_MS = 300;
const MAX_PARTICLES = 480;
const GRAVITY = -38; // world units / s²

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  spin: number;
}

/**
 * Purely visual line-clear feedback (REQ-V5): white flash on cleared rows and a burst of
 * small cubes. The simulation never waits for these.
 */
export class Effects {
  readonly group = new THREE.Group();
  private readonly flashes: Array<{ mesh: THREE.Mesh; t: number }> = [];
  private readonly flashMat: THREE.MeshBasicMaterial;
  private readonly particles: Particle[] = [];
  private readonly pmesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
  private readonly colors = new Map<PieceKind, THREE.Color>();
  private elapsed = 0;

  constructor(private readonly width: number) {
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 1.04, 1.04), this.flashMat.clone());
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.flashes.push({ mesh, t: FLASH_MS });
      this.group.add(mesh);
    }
    this.pmesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      MAX_PARTICLES,
    );
    this.pmesh.count = 0;
    this.pmesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pmesh.setColorAt(i, new THREE.Color(1, 1, 1));
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        spin: 0,
      });
    }
    this.group.add(this.pmesh);
  }

  private color(kind: PieceKind): THREE.Color {
    let c = this.colors.get(kind);
    if (!c) {
      c = materialColor(kind);
      this.colors.set(kind, c);
    }
    return c;
  }

  lineClear(rows: readonly number[], kinds: readonly PieceKind[], reducedMotion: boolean): void {
    rows.slice(0, 4).forEach((row, i) => {
      const f = this.flashes[i];
      if (!f) return;
      f.t = 0;
      f.mesh.position.set(0, row + 0.5, 0);
      f.mesh.visible = true;
    });
    if (reducedMotion) return;
    let slot = 0;
    rows.forEach((row, ri) => {
      for (let x = 0; x < this.width; x++) {
        const kind = kinds[ri * this.width + x] ?? 'O';
        for (let k = 0; k < 3; k++) {
          while (slot < MAX_PARTICLES && this.particles[slot]?.alive) slot++;
          const p = this.particles[slot];
          if (!p) return;
          const [wx, wy, wz] = cellToWorld(x, row, this.width);
          p.alive = true;
          p.life = 0;
          p.spin = (Math.random() - 0.5) * 12;
          p.pos.set(wx + (Math.random() - 0.5) * 0.6, wy + (Math.random() - 0.5) * 0.6, wz);
          p.vel.set((Math.random() - 0.5) * 8, 4 + Math.random() * 7, 2 + Math.random() * 6);
          this.pmesh.setColorAt(slot, this.color(kind));
        }
      }
    });
    if (this.pmesh.instanceColor) this.pmesh.instanceColor.needsUpdate = true;
  }

  update(dtMs: number): void {
    this.elapsed += dtMs;
    for (const f of this.flashes) {
      if (!f.mesh.visible) continue;
      f.t += dtMs;
      const mat = f.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 * (1 - f.t / FLASH_MS));
      if (f.t >= FLASH_MS) f.mesh.visible = false;
    }
    const dt = dtMs / 1000;
    let highest = 0;
    this.particles.forEach((p, i) => {
      if (!p.alive) {
        this.m.makeScale(0, 0, 0);
        this.pmesh.setMatrixAt(i, this.m);
        return;
      }
      p.life += dtMs;
      if (p.life >= PARTICLE_MS) {
        p.alive = false;
        this.m.makeScale(0, 0, 0);
        this.pmesh.setMatrixAt(i, this.m);
        return;
      }
      p.vel.y += GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      const k = 1 - p.life / PARTICLE_MS;
      this.s.set(k, k, k);
      this.q.setFromAxisAngle(this.axis, p.spin * (p.life / 1000));
      this.m.compose(p.pos, this.q, this.s);
      this.pmesh.setMatrixAt(i, this.m);
      highest = i + 1;
    });
    this.pmesh.count = highest;
    this.pmesh.instanceMatrix.needsUpdate = true;
  }
}
