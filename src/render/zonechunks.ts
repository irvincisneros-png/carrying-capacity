// Grown zone buildings, baked into one merged mesh per chunk of tiles instead of one BatchedMesh instance each.
// Why: every instance of a BatchedMesh is its own sub-draw, and software GL (a school Chromebook's fallback) pays a fixed
// cost per sub-draw, so 700 grown tiles cost far more than their triangles suggest. One merged Mesh per 24x24 chunk is
// a handful of real draw calls, is frustum-culled with a true bounding sphere, and rebuilds only the chunk that changed.
// Buildings that are still growing or being demolished stay in the animated batch (see BuildingLayer) until they settle.
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Mesh, Vector3, type Group, type Material } from 'three';

/** Tiles along one side of a chunk (3x3 chunks on the 64x64 and 72x72 maps, so at most nine draw calls, eighteen with a shadow pass). */
export const ZONE_CHUNK = 24;

interface Item { geo: BufferGeometry; m: Matrix4; c: Color }
interface Chunk {
  items: Map<number, Item>;
  dirty: boolean;
  mesh: Mesh | null;
  outline: Mesh | null;
}

const _v = new Vector3();

export class ZoneChunks {
  private chunks = new Map<number, Chunk>();
  private where = new Map<number, number>();
  private outlineOn = true;
  private dirty = new Set<number>();

  constructor(private group: Group, private mat: Material, private outlineMat: Material | null) {}

  private keyOf(tx: number, ty: number): number {
    return Math.floor(ty / ZONE_CHUNK) * 1024 + Math.floor(tx / ZONE_CHUNK);
  }

  has(uid: number): boolean {
    return this.where.has(uid);
  }

  /** Put (or move) a building in its chunk. `geo` is a prepped batch geometry (position, normal, color, onrm), `m` its world matrix. */
  set(uid: number, tx: number, ty: number, geo: BufferGeometry, m: Matrix4, c: Color): void {
    this.remove(uid);
    const key = this.keyOf(tx, ty);
    let ch = this.chunks.get(key);
    if (!ch) {
      ch = { items: new Map(), dirty: false, mesh: null, outline: null };
      this.chunks.set(key, ch);
    }
    ch.items.set(uid, { geo, m: m.clone(), c: c.clone() });
    this.where.set(uid, key);
    this.dirty.add(key);
  }

  remove(uid: number): void {
    const key = this.where.get(uid);
    if (key === undefined) return;
    this.where.delete(uid);
    this.chunks.get(key)?.items.delete(uid);
    this.dirty.add(key);
  }

  setOutlines(on: boolean): void {
    this.outlineOn = on;
    for (const ch of this.chunks.values()) if (ch.outline) ch.outline.visible = on;
  }

  /** Rebuild the chunks that changed since the last call. */
  rebuild(): void {
    if (!this.dirty.size) return;
    for (const key of this.dirty) {
      const ch = this.chunks.get(key);
      if (!ch) continue;
      this.disposeMeshes(ch);
      if (!ch.items.size) { this.chunks.delete(key); continue; }
      let n = 0;
      for (const it of ch.items.values()) n += it.geo.attributes.position!.count;
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), onr = new Float32Array(n * 3);
      let o = 0;
      for (const it of ch.items.values()) {
        const g = it.geo;
        const gp = g.attributes.position!, gn = g.attributes.normal!, gc = g.attributes.color!, go = g.attributes.onrm!;
        const e = it.m.elements;
        for (let i = 0; i < gp.count; i++, o += 3) {
          _v.set(gp.getX(i), gp.getY(i), gp.getZ(i)).applyMatrix4(it.m);
          pos[o] = _v.x; pos[o + 1] = _v.y; pos[o + 2] = _v.z;
          // the batch shader turns normals by mat3(matrix) and renormalises, so do the same here
          const nx = gn.getX(i), ny = gn.getY(i), nz = gn.getZ(i);
          let x = e[0]! * nx + e[4]! * ny + e[8]! * nz, y = e[1]! * nx + e[5]! * ny + e[9]! * nz, z = e[2]! * nx + e[6]! * ny + e[10]! * nz;
          let l = Math.hypot(x, y, z) || 1;
          nrm[o] = x / l; nrm[o + 1] = y / l; nrm[o + 2] = z / l;
          const ox = go.getX(i), oy = go.getY(i), oz = go.getZ(i);
          x = e[0]! * ox + e[4]! * oy + e[8]! * oz; y = e[1]! * ox + e[5]! * oy + e[9]! * oz; z = e[2]! * ox + e[6]! * oy + e[10]! * oz;
          l = Math.hypot(x, y, z) || 1;
          onr[o] = x / l; onr[o + 1] = y / l; onr[o + 2] = z / l;
          col[o] = gc.getX(i) * it.c.r; col[o + 1] = gc.getY(i) * it.c.g; col[o + 2] = gc.getZ(i) * it.c.b;
        }
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
      geo.setAttribute('color', new Float32BufferAttribute(col, 3));
      geo.setAttribute('onrm', new Float32BufferAttribute(onr, 3));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new Mesh(geo, this.mat);
      mesh.name = 'zone-chunk';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      ch.mesh = mesh;
      if (this.outlineMat) {
        const out = new Mesh(geo, this.outlineMat);
        out.name = 'zone-outline';
        out.visible = this.outlineOn;
        this.group.add(out);
        ch.outline = out;
      }
    }
    this.dirty.clear();
  }

  private disposeMeshes(ch: Chunk): void {
    const geo = ch.mesh?.geometry;
    if (ch.mesh) this.group.remove(ch.mesh);
    if (ch.outline) this.group.remove(ch.outline);
    geo?.dispose();
    ch.mesh = null;
    ch.outline = null;
  }

  dispose(): void {
    for (const ch of this.chunks.values()) this.disposeMeshes(ch);
    this.chunks.clear();
    this.where.clear();
    this.dirty.clear();
  }

  /** Meshes drawn right now (for tests and the perf probe). */
  get meshCount(): number {
    let n = 0;
    for (const ch of this.chunks.values()) if (ch.mesh) n++;
    return n;
  }
}
