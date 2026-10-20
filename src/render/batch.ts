// Thin wrapper over three's BatchedMesh: lazy geometry registration by key, automatic capacity growth,
// optional mirrored outline batch (inverted hull) sharing the same instance transforms.
import { BatchedMesh, BufferGeometry, Color, Float32BufferAttribute, type Material, type Matrix4 } from 'three';

/** Strip to the attribute set every batched geometry must share and add smooth outline normals. */
export function prepBatchGeo(src: BufferGeometry): BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position!;
  const nrm = g.attributes.normal!;
  if (!g.attributes.color) g.setAttribute('color', new Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
  // smooth normals keyed by quantised position: used to extrude the ink outline without cracks
  const acc = new Map<string, [number, number, number]>();
  const key = (i: number): string => `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = acc.get(k);
    if (a) { a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); }
    else acc.set(k, [nrm.getX(i), nrm.getY(i), nrm.getZ(i)]);
  }
  const on = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(key(i))!;
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    on[i * 3] = a[0] / l;
    on[i * 3 + 1] = a[1] / l;
    on[i * 3 + 2] = a[2] / l;
  }
  g.setAttribute('onrm', new Float32BufferAttribute(on, 3));
  return g;
}

export class Batch {
  mesh: BatchedMesh;
  outline: BatchedMesh | null = null;
  private geoIds = new Map<string, number>();
  private geos = new Map<string, BufferGeometry>();
  private maxInst: number;
  private maxVerts: number;
  private usedVerts = 0;
  private live = 0;

  constructor(private mat: Material, private outlineMat: Material | null, maxInst = 512, maxVerts = 200_000) {
    this.maxInst = maxInst;
    this.maxVerts = maxVerts;
    this.mesh = this.make(mat);
    if (outlineMat) this.outline = this.make(outlineMat);
  }

  private make(mat: Material): BatchedMesh {
    const m = new BatchedMesh(this.maxInst, this.maxVerts, this.maxVerts * 2, mat);
    m.sortObjects = false;
    m.perObjectFrustumCulled = true;
    // the whole-batch bounding sphere is computed once and goes stale as instances are added
    m.frustumCulled = false;
    return m;
  }

  has(key: string): boolean {
    return this.geoIds.has(key);
  }

  /** Register geometry (already prepped) once; returns its id. */
  geo(key: string, make: () => BufferGeometry): number {
    const id = this.geoIds.get(key);
    if (id !== undefined) return id;
    const g = make();
    const n = g.attributes.position!.count;
    if (this.usedVerts + n > this.maxVerts) {
      this.maxVerts = Math.max(this.maxVerts * 2, this.usedVerts + n + 50_000);
      this.mesh.setGeometrySize(this.maxVerts, this.maxVerts * 2);
      this.outline?.setGeometrySize(this.maxVerts, this.maxVerts * 2);
    }
    const gid = this.mesh.addGeometry(g);
    if (this.outline) this.outline.addGeometry(g);
    this.usedVerts += n;
    this.geoIds.set(key, gid);
    this.geos.set(key, g);
    return gid;
  }

  add(gid: number, m: Matrix4, color?: Color): number {
    if (this.live >= this.maxInst) {
      this.maxInst *= 2;
      this.mesh.setInstanceCount(this.maxInst);
      this.outline?.setInstanceCount(this.maxInst);
    }
    const id = this.mesh.addInstance(gid);
    this.mesh.setMatrixAt(id, m);
    if (color) this.mesh.setColorAt(id, color);
    if (this.outline) {
      const oid = this.outline.addInstance(gid);
      // instance ids stay in lock-step because both batches add / delete identically
      if (oid !== id) console.warn('outline batch desync', oid, id);
      this.outline.setMatrixAt(oid, m);
    }
    this.live++;
    return id;
  }

  set(id: number, m: Matrix4): void {
    this.mesh.setMatrixAt(id, m);
    this.outline?.setMatrixAt(id, m);
  }

  color(id: number, c: Color): void {
    this.mesh.setColorAt(id, c);
  }

  visible(id: number, v: boolean): void {
    this.mesh.setVisibleAt(id, v);
    this.outline?.setVisibleAt(id, v);
  }

  remove(id: number): void {
    this.mesh.deleteInstance(id);
    this.outline?.deleteInstance(id);
    this.live--;
  }

  get count(): number {
    return this.live;
  }

  dispose(): void {
    this.mesh.dispose();
    this.outline?.dispose();
    for (const g of this.geos.values()) g.dispose();
  }
}
