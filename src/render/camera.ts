// Orbit / pan / zoom camera rig for the diorama: mouse + touch via OrbitControls, clamped, Q/E 90-degree turns,
// keyboard panning, gentle idle drift for the title screen, and a small screen-shake for juicy feedback.
import { MOUSE, PerspectiveCamera, Spherical, TOUCH, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DEG = Math.PI / 180;

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private halfW: number;
  private halfH: number;
  private turnFrom = 0;
  private turnTo = 0;
  private turnT = 1;
  private shakeAmt = 0;
  private readonly _off = new Vector3();
  private readonly _sph = new Spherical();
  private readonly _pan = new Vector3();
  private readonly _shake = new Vector3();
  private keys = new Set<string>();
  /** Slowly orbit (title screen / epilogue). */
  idleSpin = 0;
  private fly: { from: Vector3; to: Vector3; tFrom: Vector3; tTo: Vector3; t: number; dur: number } | null = null;

  constructor(dom: HTMLElement, mapW: number, mapH: number) {
    this.halfW = mapW / 2;
    this.halfH = mapH / 2;
    this.camera = new PerspectiveCamera(32, 1, 0.5, 2000);
    const c = new OrbitControls(this.camera, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.minPolarAngle = 28 * DEG;
    c.maxPolarAngle = 68 * DEG;
    c.minDistance = 9;
    c.maxDistance = Math.max(mapW, mapH) * 2.6;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.rotateSpeed = 0.6;
    c.panSpeed = 1.1;
    c.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
    c.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
    c.keys = { LEFT: '', UP: '', RIGHT: '', BOTTOM: '' };
    this.controls = c;
    this.home(false);
    c.addEventListener('change', () => this.clamp());
  }

  /** Default close 3/4 view (like the style-lab B shot). */
  home(animate = true): void {
    const target = new Vector3(-this.halfW * 0.12, 0, this.halfH * 0.05);
    const dist = Math.max(this.halfW, this.halfH) * 2.6;
    const pos = new Vector3().setFromSpherical(new Spherical(dist, 50 * DEG, 0.62)).add(target);
    if (animate) this.flyTo(pos, target, 1.1);
    else {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.controls.update();
    }
  }

  flyTo(pos: Vector3, target: Vector3, dur = 1): void {
    this.fly = { from: this.camera.position.clone(), to: pos.clone(), tFrom: this.controls.target.clone(), tTo: target.clone(), t: 0, dur };
  }

  /** Centre the view on a world point keeping the current angle. */
  focus(x: number, z: number, dist?: number): void {
    const t = new Vector3(x, 0.3, z);
    const off = this.camera.position.clone().sub(this.controls.target);
    if (dist) off.setLength(dist);
    this.flyTo(t.clone().add(off), t, 0.8);
  }

  /** Rotate 90 degrees around the target (dir +1 = Q / -1 = E). */
  turn(dir: 1 | -1): void {
    this._off.copy(this.camera.position).sub(this.controls.target);
    this._sph.setFromVector3(this._off);
    const cur = this._sph.theta;
    const base = this.turnT < 1 ? this.turnTo : cur;
    this.turnFrom = cur;
    this.turnTo = base + dir * (Math.PI / 2);
    this.turnT = 0;
  }

  shake(amount: number): void {
    this.shakeAmt = Math.min(0.25, this.shakeAmt + amount);
  }

  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  private clamp(): void {
    const t = this.controls.target;
    const mx = this.halfW + 1;
    const mz = this.halfH + 1;
    t.x = Math.max(-mx, Math.min(mx, t.x));
    t.z = Math.max(-mz, Math.min(mz, t.z));
    t.y = Math.max(-1, Math.min(2, t.y));
  }

  update(dt: number): void {
    const c = this.controls;
    this.camera.position.sub(this._shake);
    this._shake.set(0, 0, 0);
    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 4 * f.t * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 3) / 2;
      this.camera.position.lerpVectors(f.from, f.to, e);
      c.target.lerpVectors(f.tFrom, f.tTo, e);
      if (f.t >= 1) this.fly = null;
    }
    if (this.turnT < 1 || this.idleSpin !== 0) {
      this._off.copy(this.camera.position).sub(c.target);
      this._sph.setFromVector3(this._off);
      if (this.turnT < 1) {
        this.turnT = Math.min(1, this.turnT + dt / 0.45);
        const e = 1 - Math.pow(1 - this.turnT, 3);
        this._sph.theta = this.turnFrom + (this.turnTo - this.turnFrom) * e;
      } else {
        this._sph.theta += this.idleSpin * dt;
      }
      this._off.setFromSpherical(this._sph);
      this.camera.position.copy(c.target).add(this._off);
    }
    // keyboard pan relative to the view direction
    if (this.keys.size) {
      let fx = 0;
      let fz = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fz -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fz += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) fx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) fx += 1;
      if (fx || fz) {
        this._off.copy(this.camera.position).sub(c.target);
        const yaw = Math.atan2(this._off.x, this._off.z);
        const sp = dt * (6 + this._off.length() * 0.35);
        this._pan.set(fx * Math.cos(yaw) + fz * Math.sin(yaw), 0, -fx * Math.sin(yaw) + fz * Math.cos(yaw)).multiplyScalar(sp);
        c.target.add(this._pan);
        this.camera.position.add(this._pan);
        this.clamp();
      }
    }
    c.update(dt);
    if (this.shakeAmt > 0.001) {
      this._shake.set((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt * 0.6, (Math.random() - 0.5) * this.shakeAmt);
      this.camera.position.add(this._shake);
      this.shakeAmt *= Math.exp(-dt * 14);
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // narrow screens: pull back a little so the slab fits
    this.camera.fov = w < h ? 44 : 32;
    this.camera.updateProjectionMatrix();
  }

  /** Mouse left button: pan in select mode, free for building tools. */
  setLeftPans(pans: boolean): void {
    this.controls.mouseButtons.LEFT = pans ? MOUSE.PAN : (null as unknown as MOUSE);
    this.controls.touches.ONE = TOUCH.PAN;
  }
}
