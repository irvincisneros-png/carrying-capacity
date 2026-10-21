// A small floating "no road" marker over each building the road network does not reach: a cream painted token with a
// road that stops short of the door. Gentle, warm colours (this is a hint, not an alarm).
import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace, type Texture } from 'three';
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

export class RoadMarkers {
  readonly group = new Group();
  private sprites = new Map<number, { s: Sprite; y: number }>();
  private tex: Texture | null = null;
  private mat: SpriteMaterial | null = null;
  private sig = '';

  constructor(private map: MapGeo, parent: Group) {
    this.group.name = 'road-markers';
    parent.add(this.group);
  }

  sync(s: GameState): void {
    const live = s.phase === 'act1' || s.phase === 'act2';
    const acc = live ? roadAccess(s) : null;
    const list = acc && acc.enforced ? acc.unconnected : [];
    const sig = list.join(',');
    if (sig === this.sig) return;
    this.sig = sig;
    const want = new Set(list);
    for (const [uid, m] of this.sprites) {
      if (!want.has(uid)) { this.group.remove(m.s); this.sprites.delete(uid); }
    }
    if (!list.length) return;
    if (!this.tex) {
      this.tex = tokenTexture();
      this.mat = new SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    }
    const byUid = new Map(s.buildings.map((b) => [b.uid, b] as const));
    for (const uid of list) {
      if (this.sprites.has(uid)) continue;
      const b = byUid.get(uid);
      if (!b) continue;
      const spr = new Sprite(this.mat!);
      const x = this.map.cx(b.x) + (b.w - 1) / 2;
      const z = this.map.cz(b.y) + (b.h - 1) / 2;
      const y = Math.max(this.map.heightAt(x, z), 0) + 0.55 + Math.max(b.w, b.h) * 0.3;
      spr.position.set(x, y, z);
      spr.scale.set(0.5, 0.5, 1);
      spr.renderOrder = 6;
      this.group.add(spr);
      this.sprites.set(uid, { s: spr, y });
    }
  }

  update(time: number): void {
    let i = 0;
    for (const m of this.sprites.values()) m.s.position.y = m.y + Math.sin(time * 1.8 + i++) * 0.04;
  }

  dispose(): void {
    this.mat?.dispose();
    this.tex?.dispose();
    this.group.removeFromParent();
    this.sprites.clear();
  }
}
