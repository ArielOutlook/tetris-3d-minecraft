import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BOARD_WIDTH, VISIBLE_ROWS } from '../config';
import type { Quality } from '../storage/highscores';

const FOV = 35;
/** World area that must stay visible with the default camera (well + frame + margin). */
const FRAME_HEIGHT = VISIBLE_ROWS + 4;
const FRAME_WIDTH = BOARD_WIDTH + 6;
/** Portrait screens reserve room above (HUD) and below (touch buttons) the well. */
const PORTRAIT_ASPECT = 0.9;
const PORTRAIT_FRAME_HEIGHT = VISIBLE_ROWS + 11;
const PORTRAIT_TARGET_Y = VISIBLE_ROWS / 2 + 1.5;
const TILT = 0.16; // radians above the horizontal
const RESET_MS = 300;

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#2f6fc4');
    g.addColorStop(0.55, '#7fb6ea');
    g.addColorStop(1, '#d6ecfb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Owns the WebGL renderer, camera, lights and the bounded orbit controls. */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly sun: THREE.DirectionalLight;
  private quality: Quality;
  private tween: { t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3 } | null = null;
  private shake = { t: 0, duration: 0, amp: 0 };
  private readonly shakeOffset = new THREE.Vector3();
  /** Default look-at point; depends on the aspect ratio. */
  private readonly target = new THREE.Vector3(0, VISIBLE_ROWS / 2, 0);

  constructor(
    readonly canvas: HTMLCanvasElement,
    quality: Quality,
  ) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0xbfdcf4, 45, 110);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 300);

    const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b5a45, 1.4);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.position.set(-10, 30, 18);
    this.sun.target.position.set(0, 8, 0);
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 18;
    sc.bottom = -16;
    sc.near = 5;
    sc.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minAzimuthAngle = -Math.PI / 4;
    this.controls.maxAzimuthAngle = Math.PI / 4;
    this.controls.minPolarAngle = Math.PI / 2 - 0.75;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.12;

    this.applyQuality();
    this.resize();
    this.placeDefault();
  }

  /** Distance that frames the whole well for the current aspect ratio (REQ-C1). */
  defaultDistance(): number {
    const half = THREE.MathUtils.degToRad(FOV / 2);
    const aspect = this.camera.aspect || 1;
    const frameHeight = aspect < PORTRAIT_ASPECT ? PORTRAIT_FRAME_HEIGHT : FRAME_HEIGHT;
    const byHeight = frameHeight / 2 / Math.tan(half);
    const byWidth = FRAME_WIDTH / 2 / (Math.tan(half) * aspect);
    return Math.max(byHeight, byWidth);
  }

  defaultPosition(): THREE.Vector3 {
    const d = this.defaultDistance();
    return new THREE.Vector3(0, this.target.y + Math.sin(TILT) * d, Math.cos(TILT) * d);
  }

  private placeDefault(): void {
    this.camera.position.copy(this.defaultPosition());
    this.controls.target.copy(this.target);
    this.updateDistanceLimits();
    this.controls.update();
  }

  private updateDistanceLimits(): void {
    const d = this.defaultDistance();
    this.controls.minDistance = d * 0.55;
    this.controls.maxDistance = d * 1.6;
  }

  /** Smoothly returns to the default view (key C). */
  resetCamera(): void {
    this.tween = { t: 0, fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone() };
  }

  /** Optional short shake (4-line clear). Callers check prefers-reduced-motion. */
  startShake(durationMs = 200, amp = 0.22): void {
    this.shake = { t: 0, duration: durationMs, amp };
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.applyQuality();
    this.resize();
  }

  private applyQuality(): void {
    const high = this.quality === 'alto';
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m.needsUpdate = true;
    });
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const before = this.defaultDistance();
    const prevTargetY = this.target.y;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.target.y = this.camera.aspect < PORTRAIT_ASPECT ? PORTRAIT_TARGET_Y : VISIBLE_ROWS / 2;
    const dy = this.target.y - prevTargetY;
    if (dy !== 0) {
      this.controls.target.y += dy;
      this.camera.position.y += dy;
    }
    // Keep the same relative zoom after an aspect change.
    const after = this.defaultDistance();
    if (Math.abs(after - before) > 1e-3) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.multiplyScalar(after / before);
      this.camera.position.copy(this.controls.target).add(offset);
    }
    this.updateDistanceLimits();
  }

  update(dtMs: number): void {
    if (this.tween) {
      this.tween.t = Math.min(1, this.tween.t + dtMs / RESET_MS);
      const k = 1 - Math.pow(1 - this.tween.t, 3);
      this.camera.position.lerpVectors(this.tween.fromPos, this.defaultPosition(), k);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.target, k);
      if (this.tween.t >= 1) this.tween = null;
    }
    this.controls.update();
    this.shakeOffset.set(0, 0, 0);
    if (this.shake.t < this.shake.duration) {
      this.shake.t += dtMs;
      const fall = 1 - this.shake.t / this.shake.duration;
      const a = this.shake.amp * Math.max(0, fall);
      this.shakeOffset.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0);
    }
  }

  render(): void {
    this.camera.position.add(this.shakeOffset);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.sub(this.shakeOffset);
  }
}
