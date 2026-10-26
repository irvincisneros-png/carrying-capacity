// A small floating "no road" marker over each building the road network does not reach: a cream painted token with a
// road that stops short of the door. Gentle, warm colours (this is a hint, not an alarm).
import { CanvasTexture, Group, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3, type Camera, type Texture } from 'three';
import { roadAccess } from '../sim/roads';
import type { GameState } from '../sim/types';
import type { MapGeo } from './mapgeo';

function tokenTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  // soft shadow + cream disc with a thin ochre rim
  g.fillStyle = 'rgba(70,50,30,0.22)';
  g.beginPath(); g.arc(66, 70, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f7ecd2';
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c98a4a';
  g.lineWidth = 5;
  g.beginPath(); g.arc(64, 64, 49, 0, Math.PI * 2); g.stroke();
  // a road coming in from the lower left that stops short, then the building's door at the upper right
  g.lineCap = 'round';
  g.strokeStyle = '#8a7a68';
  g.lineWidth = 15;
  g.beginPath(); g.moveTo(26, 98); g.lineTo(52, 74); g.stroke();
  g.strokeStyle = '#f7ecd2';
  g.lineWidth = 3;
  g.setLineDash([5, 6]);
  g.beginPath(); g.moveTo(28, 96); g.lineTo(51, 75); g.stroke();
  g.setLineDash([]);
  // the gap, then a dashed ghost of the missing piece
  g.strokeStyle = '#c98a4a';
  g.lineWidth = 5;
  g.setLineDash([2, 9]);
  g.beginPath(); g.moveTo(60, 66); g.lineTo(84, 44); g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#b5623a';
  g.fillRect(80, 24, 22, 20);
  g.fillStyle = '#e8c58a';
  g.beginPath(); g.moveTo(76, 26); g.lineTo(91, 12); g.lineTo(106, 26); g.closePath(); g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const _m = new Matrix4();
const _one = new Vector3(0.5, 0.5, 1);
const _pos = new Vector3();

/**
 * One InstancedMesh for every token (a single draw call however many buildings lack a road; they used to be one Sprite,
 * so one draw call, each). The quads are turned to face the camera in onBeforeRender, like sprites.
 */
export class RoadMarkers {
  readonly group = new Group();
  private mesh: InstancedMesh | null = null;
  private tex: Texture | null = null;
  private mat: MeshBasicMaterial | null = null;
  private pts: { x: number; y: number; z: number }[] = [];
  private time = 0;
  private sig = '';

  constructor(private map: MapGeo, parent: Group) {
    this.group.name = 'road-markers';
    parent.add(this.group);
  }

  private ensure(n: number): InstancedMesh {
    if (this.mesh && this.mesh.instanceMatrix.count >= n) return this.mesh;
    if (!this.tex) {
      this.tex = tokenTexture();
      this.mat = new MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    }
    const old = this.mesh;
    const cap = Math.max(64, n, (old?.instanceMatrix.count ?? 0) * 2);
    const m = new InstancedMesh(old?.geometry ?? new PlaneGeometry(1, 1), this.mat!, cap);
    m.name = 'road-markers';
    m.frustumCulled = false;
    m.renderOrder = 6;
    m.onBeforeRender = (_r, _s, cam: Camera) => this.face(m, cam);
    if (old) { this.group.remove(old); old.dispose(); }
    this.group.add(m);
    this.mesh = m;
    return m;
  }

  private face(m: InstancedMesh, cam: Camera): void {
    const q = cam.quaternion;
    for (let i = 0; i < this.pts.length; i++) {
      const p = this.pts[i]!;
      _pos.set(p.x, p.y + Math.sin(this.time * 1.8 + i) * 0.04, p.z);
      _m.compose(_pos, q, _one);
      m.setMatrixAt(i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
  }

  sync(s: GameState): void {
    const live = s.phase === 'act1' || s.phase === 'act2';
    const acc = live ? roadAccess(s) : null;
    const list = acc && acc.enforced ? acc.unconnected : [];
    const sig = list.join(',');
    if (sig === this.sig) return;
    this.sig = sig;
    this.pts = [];
    const byUid = new Map(s.buildings.map((b) => [b.uid, b] as const));
    for (const uid of list) {
      const b = byUid.get(uid);
      if (!b) continue;
      const x = this.map.cx(b.x) + (b.w - 1) / 2;
      const z = this.map.cz(b.y) + (b.h - 1) / 2;
      const y = Math.max(this.map.heightAt(x, z), 0) + 0.55 + Math.max(b.w, b.h) * 0.3;
      this.pts.push({ x, y, z });
    }
    const m = this.pts.length ? this.ensure(this.pts.length) : this.mesh;
    if (m) { m.count = this.pts.length; m.visible = this.pts.length > 0; }
  }

  update(time: number): void {
    this.time = time;
  }

  dispose(): void {
    this.mat?.dispose();
    this.tex?.dispose();
    this.mesh?.dispose();
    this.group.removeFromParent();
    this.pts = [];
  }
}
