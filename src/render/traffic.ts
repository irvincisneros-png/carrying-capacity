// Moving life: cars, trucks, buses (and horse carts before motor cars) drive the CONNECTED road network between homes
// and workplaces, keeping to the left and slowing at junctions; pedestrians walk the road edges, children and strollers
// play at pocket parks and restored shores, cyclists ride in Act 2, a tractor works a farm paddock.
// Everything is one BatchedMesh updated every frame from AmbientLayer.update. Render-side randomness only (seeded, so
// screenshots repeat); the sim is only read (roadAccess, commuteStats).
import { Color, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { BUILDINGS } from '../sim/buildings';
import { commuteStats, roadAccess, TRANSIT_MAX } from '../sim/roads';
import { TileKind, type BuildingId, type GameState } from '../sim/types';
import { Batch, prepBatchGeo } from './batch';
import type { MapGeo } from './mapgeo';
import type { MatLib } from './materials';
import { buildAmbient } from './models/ambient';
import { buildTraffic, PERSON_IDS, type TrafficId } from './models/traffic';
import { ASPHALT_LIFT } from './roadnet';
import type { Tier } from './quality';

type Kind = 'car' | 'truck' | 'bus' | 'cart' | 'ped' | 'cyclist' | 'orbit';

interface Caps { cars: number; peds: number; orbits: number; buses: number; cyclists: number }
/** Most agents of each sort per graphics tier. Very low keeps a handful of cars and nothing else. */
const CAPS: readonly Caps[] = [
  { cars: 3, peds: 0, orbits: 0, buses: 0, cyclists: 0 },
  { cars: 10, peds: 6, orbits: 2, buses: 0, cyclists: 1 },
  { cars: 24, peds: 20, orbits: 8, buses: 2, cyclists: 5 },
  { cars: 36, peds: 32, orbits: 12, buses: 3, cyclists: 8 },
  { cars: 52, peds: 46, orbits: 16, buses: 4, cyclists: 12 },
];

const INDUSTRY: ReadonlySet<BuildingId> = new Set<BuildingId>(['factory', 'steelworks', 'coalpower', 'coalmine', 'landfill', 'gaspower', 'excavation', 'port', 'recycler', 'greensteel', 'windport']);
const CAR_COLS = [0xc23b2e, 0x2f5f9a, 0xe8e2d0, 0x3d7a4e, 0xe0b23a, 0x6a6e74, 0x8a3a5a, 0x1f2a36];
const SPEED: Record<Kind, number> = { car: 0.95, truck: 0.7, bus: 0.72, cart: 0.42, ped: 0.24, cyclist: 0.5, orbit: 0.2 };
const LANE = 0.1; // left-hand traffic: this far left of the centre line
const WALK = 0.285; // footpath, just outside the kerb
const DX = [0, 1, 0, -1];
const DY = [1, 0, -1, 0];

const _m = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _q3 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _ax = new Vector3(1, 0, 0);
const _az = new Vector3(0, 0, 1);
const _c = new Color();

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Agent {
  kind: Kind;
  inst: number;
  geo: number;
  col: number;
  scale: number;
  state: 'wait' | 'go' | 'park';
  t: number; // seconds in the current state
  waitFor: number;
  path: number[];
  k: number;
  u: number;
  lane: number;
  speed: number;
  v: number;
  /** current tile curve: entry E, control C, exit X, length, speed factor */
  ex: number; ez: number; cx: number; cz: number; xx: number; xz: number; len: number; slow: number;
  x: number; z: number; hx: number; hz: number;
  phase: number;
  /** trip bookkeeping: 0 heading to work/destination set, 1 heading back */
  leg: number;
  at: number;
  /** orbit agents (strollers, children, tractor) */
  ox: number; oz: number; or: number; oa: number; od: number;
  seed: number;
}

export class TrafficLayer {
  private batch: Batch | null = null;
  private agents: Agent[] = [];
  private detail: 0 | 1 = 1;
  private tier: Tier = 2;
  private state: GameState | null = null;
  private sig = '';
  private rand = rng(0x51f15e);
  // graph
  private n = 0;
  private W = 0;
  private road = new Uint8Array(0);
  private deg = new Uint8Array(0);
  private prev = new Int32Array(0);
  private stamp = new Int32Array(0);
  private queue = new Int32Array(0);
  private depth = new Int16Array(0);
  private stampN = 0;
  private visited: number[] = [];
  private homeT: number[] = [];
  private workT: number[] = [];
  private indT: number[] = [];
  private placeT: number[] = [];
  private placeSet = new Uint8Array(0);
  private busT: number[] = [];
  private entranceT = -1;
  private orbitSpots: { x: number; z: number; kind: 'kid' | 'stroll' | 'tractor' }[] = [];
  private want = { car: 0, truck: 0, bus: 0, cart: 0, ped: 0, cyclist: 0, orbit: 0 };
  private replan = 0;

  constructor(private map: MapGeo, private lib: MatLib, private group: Group) {}

  setDetail(detail: 0 | 1): void {
    if (detail === this.detail) return;
    this.detail = detail;
    this.clear();
    this.sig = '';
  }

  setTier(tier: Tier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.sig = '';
  }

  private clear(): void {
    if (this.batch) {
      this.group.remove(this.batch.mesh);
      this.batch.dispose();
      this.batch = null;
    }
    this.agents.length = 0;
  }

  dispose(): void {
    this.clear();
  }

  private ensureBatch(): Batch {
    if (this.batch) return this.batch;
    const b = new Batch(this.lib.get({ key: 'ambient', kind: 'prop' }), null, 128, 40_000);
    b.mesh.castShadow = this.tier >= 2;
    b.mesh.receiveShadow = true;
    b.mesh.name = 'traffic';
    this.group.add(b.mesh);
    this.batch = b;
    return b;
  }

  // ------------------------------------------------------------------ the road graph and what it joins
  sync(s: GameState): void {
    this.state = s;
    const sig = `${s.version}:${s.buildings.length}:${this.tier}:${this.detail}:${s.phase}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const live = s.phase === 'act1' || s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed' || s.phase === 'turning-point';
    const g = s.grid;
    const n = g.w * g.h;
    if (this.n !== n) {
      this.n = n;
      this.W = g.w;
      this.road = new Uint8Array(n);
      this.deg = new Uint8Array(n);
      this.prev = new Int32Array(n);
      this.stamp = new Int32Array(n);
      this.queue = new Int32Array(n);
      this.depth = new Int16Array(n);
      this.placeSet = new Uint8Array(n);
      this.stampN = 0;
    }
    const caps = CAPS[this.tier]!;
    const acc = roadAccess(s);
    const byUid = new Map<number, BuildingId>();
    for (const b of s.buildings) byUid.set(b.uid, b.type);
    // drivable tiles: the road network joined to the entrance (stubs and islands never carry traffic)
    this.road.fill(0);
    let roads = 0;
    for (let i = 0; i < n; i++) {
      const u = g.building[i] ?? 0;
      if (!u) continue;
      const t = byUid.get(u);
      if (!t || BUILDINGS[t].network !== 'road') continue;
      if (acc.enforced && acc.reached[i] !== 1) continue;
      this.road[i] = 1;
      roads++;
    }
    for (let i = 0; i < n; i++) {
      if (!this.road[i]) { this.deg[i] = 0; continue; }
      let d = 0;
      for (let k = 0; k < 4; k++) if (this.at(i, k) >= 0) d++;
      this.deg[i] = d;
    }
    this.homeT = []; this.workT = []; this.indT = []; this.placeT = []; this.busT = [];
    this.placeSet.fill(0);
    this.orbitSpots = [];
    let housing = 0, jobs = 0, indJobs = 0, lines = 0;
    const roadsAround = (b: { x: number; y: number; w: number; h: number }, out: number[]): void => {
      const add = (xx: number, yy: number): void => {
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) return;
        const i = yy * g.w + xx;
        if (this.road[i]) out.push(i);
      };
      for (let k = 0; k < b.w; k++) { add(b.x + k, b.y - 1); add(b.x + k, b.y + b.h); }
      for (let k = 0; k < b.h; k++) { add(b.x - 1, b.y + k); add(b.x + b.w, b.y + k); }
    };
    const farms: { x: number; y: number; w: number; h: number }[] = [];
    for (const b of acc.workingBuildings) {
      const d = BUILDINGS[b.type];
      if (b.type === 'farm' || b.type === 'dripfarm') farms.push(b);
      if (d.housing > 0) { housing += d.housing; roadsAround(b, this.homeT); continue; }
      if (b.type === 'transitline') { lines++; roadsAround(b, this.busT); continue; }
      if (d.jobs >= 3) {
        jobs += d.jobs;
        if (INDUSTRY.has(b.type)) { indJobs += d.jobs; roadsAround(b, this.indT); }
        else roadsAround(b, this.workT);
      }
    }
    for (const b of s.buildings) {
      if (b.type === 'parkland') {
        orbitPush(this.orbitSpots, this.map.cx(b.x), this.map.cz(b.y), this.rand() < 0.6 ? 'kid' : 'stroll');
        roadsAround(b, this.placeT);
      }
    }
    for (const i of this.homeT) this.placeSet[i] = 1;
    for (const i of this.workT) this.placeSet[i] = 1;
    for (const i of this.placeT) this.placeSet[i] = 1;
    const act2 = s.phase === 'act2' || s.phase === 'epilogue';
    if (act2) {
      // restored beaches: strollers on the sand, children at the water's edge
      let found = 0;
      for (let i = 0; i < n && found < 6; i += 3) {
        if (g.kind[i] === TileKind.Beach && (g.stage[i] ?? 0) >= 2 && this.rand() < 0.12) {
          const x = i % g.w, y = Math.floor(i / g.w);
          orbitPush(this.orbitSpots, this.map.cx(x), this.map.cz(y), this.rand() < 0.5 ? 'kid' : 'stroll');
          found++;
        }
      }
    }
    // a tractor at work beside a farm paddock
    const free = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.w && y < g.h && (g.building[y * g.w + x] ?? 0) === 0 && g.kind[y * g.w + x] === TileKind.Land;
    for (const f of farms.slice(0, 4)) {
      const cands: [number, number][] = [[f.x - 1, f.y], [f.x + f.w, f.y], [f.x, f.y - 1], [f.x, f.y + f.h]];
      const c = cands.find(([x, y]) => free(x, y));
      if (c) this.orbitSpots.push({ x: this.map.cx(c[0]), z: this.map.cz(c[1]), kind: 'tractor' });
    }
    this.entranceT = acc.entrance ?? -1;
    if (this.entranceT >= 0 && !this.road[this.entranceT]) this.entranceT = -1;

    // how many of each
    const era = s.year < 1925 ? 0 : s.year < 1950 ? 1 : 2;
    const cut = act2 && acc.enforced ? Math.min(1, commuteStats(s).transitCut / TRANSIT_MAX) : 0;
    const w = this.want;
    w.car = w.truck = w.bus = w.cart = w.ped = w.cyclist = w.orbit = 0;
    const eligible = live && roads >= 2 && (housing > 0 || jobs > 0);
    if (eligible) {
      const roadCap = Math.max(1, Math.floor(roads * 0.8));
      const motor = Math.min(caps.cars, roadCap, Math.round(1 + housing / 38 + jobs / 160) * (act2 ? 1 - 0.55 * cut : 1));
      if (era === 0) w.cart = Math.min(caps.cars, Math.round(motor * 0.45) + 1);
      else {
        const trucks = this.indT.length ? Math.min(Math.round(motor * 0.3), 1 + Math.round(indJobs / 70)) : 0;
        w.truck = Math.min(trucks, motor);
        w.car = Math.max(0, Math.round((motor - w.truck) * (era === 1 ? 0.6 : 1)));
      }
      if (act2 && lines > 0) w.bus = Math.min(caps.buses, lines + 1);
      w.ped = Math.min(caps.peds, Math.round(housing / 40), roadCap * 2);
      w.cyclist = act2 ? Math.min(caps.cyclists, Math.round(1 + housing / 120 + cut * 6)) : 0;
      w.orbit = Math.min(caps.orbits, this.orbitSpots.length * 2);
      if (this.tier === 0) { w.ped = 0; w.orbit = 0; w.cyclist = 0; w.bus = 0; }
    }
    this.reconcile();
    // routes that no longer exist: re-plan from where they stand
    for (const a of this.agents) {
      if (a.state === 'go' && a.kind !== 'orbit') {
        let ok = true;
        for (let k = Math.max(0, a.k - 1); k < a.path.length && ok; k++) if (!this.road[a.path[k]!]) ok = false;
        if (!ok) { a.state = 'wait'; a.t = 0; a.waitFor = this.rand() * 1.5; this.hide(a); }
      }
    }
  }

  private at(i: number, k: number): number {
    const W = this.W;
    const x = i % W + DX[k]!;
    const y = Math.floor(i / W) + DY[k]!;
    if (x < 0 || y < 0 || x >= W || y >= this.n / W) return -1;
    const j = y * W + x;
    return this.road[j] ? j : -1;
  }

  private count(kind: Kind, kindMatch?: (a: Agent) => boolean): Agent[] {
    return this.agents.filter((a) => a.kind === kind && (!kindMatch || kindMatch(a)));
  }

  private reconcile(): void {
    const w = this.want;
    const need: [Kind, number, string][] = [
      ['car', w.car, 'car'], ['truck', w.truck, 'truck'], ['bus', w.bus, 'bus'], ['cart', w.cart, 'cart'],
      ['ped', w.ped, 'ped'], ['cyclist', w.cyclist, 'cyclist'], ['orbit', w.orbit, 'orbit'],
    ];
    for (const [kind, target] of need) {
      const have = this.count(kind);
      for (let i = have.length; i < target; i++) this.spawn(kind);
      for (let i = have.length - 1; i >= target; i--) this.drop(have[i]!);
    }
  }

  private drop(a: Agent): void {
    this.batch?.remove(a.inst);
    const i = this.agents.indexOf(a);
    if (i >= 0) this.agents.splice(i, 1);
  }

  private spawn(kind: Kind): void {
    const b = this.ensureBatch();
    const r = this.rand;
    let geoKey: string;
    let make: () => ReturnType<typeof buildAmbient>;
    let scale = 1;
    let col = 0xffffff;
    let orbitKind: 'kid' | 'stroll' | 'tractor' | null = null;
    let spot: { x: number; z: number } | null = null;
    switch (kind) {
      case 'car': geoKey = 'car'; make = () => buildAmbient('car', this.detail); col = CAR_COLS[(r() * CAR_COLS.length) | 0]!; break;
      case 'truck': geoKey = 'truck'; make = () => buildAmbient('truck', this.detail); col = CAR_COLS[(r() * CAR_COLS.length) | 0]!; break;
      case 'bus': geoKey = 'bus'; make = () => buildTraffic('bus', this.detail); break;
      case 'cart': geoKey = 'cart'; make = () => buildTraffic('cart', this.detail); break;
      case 'cyclist': geoKey = 'cyclist'; make = () => buildTraffic('cyclist', this.detail); break;
      case 'orbit': {
        const free = this.orbitSpots.filter((sp) => !this.agents.some((a) => a.kind === 'orbit' && a.ox === sp.x && a.oz === sp.z && (a.col === 1) === (sp.kind === 'tractor')));
        const sp = free.length ? free[(r() * free.length) | 0]! : this.orbitSpots[(r() * this.orbitSpots.length) | 0];
        orbitKind = sp ? sp.kind : 'stroll';
        spot = sp ?? null;
        if (orbitKind === 'tractor') { geoKey = 'tractor'; make = () => buildTraffic('tractor', this.detail); col = 1; }
        else { const v = (r() * 4) | 0; const id: TrafficId = PERSON_IDS[v]!; geoKey = id; make = () => buildTraffic(id, this.detail); scale = orbitKind === 'kid' ? 0.72 : 1; col = 0; }
        break;
      }
      default: { const v = (r() * 4) | 0; const id: TrafficId = PERSON_IDS[v]!; geoKey = id; make = () => buildTraffic(id, this.detail); }
    }
    const gid = b.geo(`${geoKey}:${this.detail}`, () => prepBatchGeo(make()));
    _m.makeScale(0, 0, 0);
    const colour = kind === 'car' || kind === 'truck' ? _c.set(col) : undefined;
    const inst = b.add(gid, _m, colour);
    b.visible(inst, false);
    const a: Agent = {
      kind, inst, geo: gid, col, scale, state: 'wait', t: 0, waitFor: r() * 3, path: [], k: 0, u: 0,
      lane: 0, speed: SPEED[kind] * (0.85 + r() * 0.3), v: 0, ex: 0, ez: 0, cx: 0, cz: 0, xx: 0, xz: 0, len: 1, slow: 1,
      x: 0, z: 0, hx: 1, hz: 0, phase: r() * 6, leg: (r() * 2) | 0, at: -1,
      ox: spot ? spot.x : 0, oz: spot ? spot.z : 0, or: 0.16 + r() * 0.12, oa: r() * 6.28, od: r() < 0.5 ? 1 : -1, seed: r(),
    };
    if (kind === 'orbit' && orbitKind === 'tractor') { a.or = 0.3; a.speed = 0.16; }
    if (kind === 'orbit' && orbitKind === 'kid') { a.or = 0.12 + r() * 0.1; a.speed = 0.3; }
    if (kind === 'orbit' && !spot) { a.state = 'wait'; a.waitFor = 1e9; }
    this.agents.push(a);
  }

  // ------------------------------------------------------------------ routing
  /** Breadth-first from `from`. With `to >= 0` returns the tile path; with -1 collects tiles within maxDepth into this.visited. */
  private bfs(from: number, to: number, maxDepth: number): number[] | null {
    const st = ++this.stampN;
    const { stamp, prev, queue, depth } = this;
    let qh = 0, qt = 0;
    queue[qt++] = from;
    stamp[from] = st;
    prev[from] = -1;
    depth[from] = 0;
    this.visited.length = 0;
    while (qh < qt) {
      const i = queue[qh++]!;
      if (i === to) {
        const path: number[] = [];
        for (let j = i; j >= 0; j = prev[j]!) path.push(j);
        return path.reverse();
      }
      this.visited.push(i);
      if (depth[i]! >= maxDepth) continue;
      // randomise the neighbour order so equal-length routes are not all the same one
      const o = (this.rand() * 4) | 0;
      for (let q = 0; q < 4; q++) {
        const j = this.at(i, (q + o) & 3);
        if (j < 0 || stamp[j] === st) continue;
        stamp[j] = st;
        prev[j] = i;
        depth[j] = depth[i]! + 1;
        queue[qt++] = j;
      }
    }
    return null;
  }

  private pathTo(from: number, set: number[]): number[] | null {
    if (!set.length) return null;
    for (let tries = 0; tries < 4; tries++) {
      const to = set[(this.rand() * set.length) | 0]!;
      if (to === from) continue;
      const p = this.bfs(from, to, 999);
      if (p && p.length >= 2) return p;
    }
    return null;
  }

  private randomRoad(): number {
    for (let tries = 0; tries < 40; tries++) {
      const i = (this.rand() * this.n) | 0;
      if (this.road[i]) return i;
    }
    return -1;
  }

  private plan(a: Agent): void {
    const r = this.rand;
    let path: number[] | null = null;
    const pick = (set: number[]): number => (set.length ? set[(r() * set.length) | 0]! : this.randomRoad());
    if (a.kind === 'ped') {
      const from = a.at >= 0 && this.road[a.at] ? a.at : pick(this.homeT.length && r() < 0.8 ? this.homeT : this.placeT.length ? this.placeT : this.workT);
      if (from >= 0) {
        this.bfs(from, -1, 11);
        const cands = this.visited.filter((i) => i !== from && this.placeSet[i]);
        const to = cands.length ? cands[(r() * cands.length) | 0]! : this.visited.length > 1 ? this.visited[this.visited.length - 1]! : -1;
        if (to >= 0) path = this.bfs(from, to, 999);
      }
    } else {
      const a0 = a.at >= 0 && this.road[a.at] ? a.at : -1;
      let from = a0;
      let dest: number[];
      switch (a.kind) {
        case 'truck': {
          // between industry and the edge of town, or a home delivery
          const towardsOut = a.leg === 0 && this.entranceT >= 0;
          if (from < 0) from = pick(this.indT);
          dest = towardsOut ? [this.entranceT] : r() < 0.5 && this.indT.length ? this.indT : this.homeT;
          break;
        }
        case 'bus': {
          if (from < 0) from = pick(this.busT.length ? this.busT : this.homeT);
          dest = a.leg === 0 ? (this.homeT.length ? this.homeT : this.workT) : (this.busT.length ? this.busT : this.workT);
          break;
        }
        case 'cyclist': {
          if (from < 0) from = pick(this.homeT);
          dest = a.leg === 0 ? (this.placeT.length ? this.placeT : this.workT) : this.homeT;
          break;
        }
        default: {
          // commuters: home <-> work, with the odd trip out of town and back in
          if (from < 0) from = pick(a.leg === 0 ? this.homeT : this.workT.length ? this.workT : this.indT);
          dest = a.leg === 0 ? (this.workT.length ? this.workT : this.indT.length ? this.indT : this.homeT) : this.homeT;
          if (r() < 0.1 && this.entranceT >= 0) dest = [this.entranceT];
        }
      }
      if (from >= 0) path = this.pathTo(from, dest);
      if (!path && from >= 0) path = this.pathTo(from, this.homeT.length ? this.homeT : this.workT);
      if (!path && from >= 0) {
        // dead end for this vehicle: wander somewhere reachable
        this.bfs(from, -1, 10);
        const to = this.visited.length > 1 ? this.visited[this.visited.length - 1]! : -1;
        if (to >= 0) path = this.bfs(from, to, 999);
      }
    }
    if (!path || path.length < 2) { a.state = 'wait'; a.t = 0; a.waitFor = 1.5 + r() * 2; a.at = -1; return; }
    a.path = path;
    a.k = 0;
    a.u = 0;
    a.leg ^= 1;
    a.lane = a.kind === 'ped' ? (r() < 0.5 ? WALK : -WALK) : a.kind === 'cyclist' ? 0.2 : a.kind === 'cart' ? 0.08 : LANE;
    a.state = 'go';
    a.t = 0;
    a.v = 0;
    this.curve(a);
    this.evaluate(a, 0);
    if (this.batch) this.batch.visible(a.inst, true);
  }

  /** Quadratic curve through path tile `k`: from the edge midpoint it was entered by to the one it leaves by. */
  private curve(a: Agent): void {
    const W = this.W;
    const t = a.path[a.k]!;
    const pv = a.k > 0 ? a.path[a.k - 1]! : -1;
    const nx = a.k < a.path.length - 1 ? a.path[a.k + 1]! : -1;
    const m = this.map;
    const cx = m.cx(t % W), cz = m.cz(Math.floor(t / W));
    let dix = 0, diz = 0, dox = 0, doz = 0;
    if (pv >= 0) { dix = (t % W) - (pv % W); diz = Math.floor(t / W) - Math.floor(pv / W); }
    if (nx >= 0) { dox = (nx % W) - (t % W); doz = Math.floor(nx / W) - Math.floor(t / W); }
    if (pv < 0) { dix = dox; diz = doz; }
    if (nx < 0) { dox = dix; doz = diz; }
    const l = a.lane;
    // left of the heading (dx, dz), seen from above with +z towards the viewer, is (dz, -dx)
    const lix = diz, liz = -dix, lox = doz, loz = -dox;
    a.ex = cx - dix * (pv >= 0 ? 0.5 : 0) + l * lix;
    a.ez = cz - diz * (pv >= 0 ? 0.5 : 0) + l * liz;
    a.xx = cx + dox * (nx >= 0 ? 0.5 : 0) + l * lox;
    a.xz = cz + doz * (nx >= 0 ? 0.5 : 0) + l * loz;
    const den = 1 + lix * lox + liz * loz;
    const k = den > 0.2 ? l / den : l;
    a.cx = cx + (lix + lox) * k;
    a.cz = cz + (liz + loz) * k;
    const d1 = Math.hypot(a.cx - a.ex, a.cz - a.ez), d2 = Math.hypot(a.xx - a.cx, a.xz - a.cz), d3 = Math.hypot(a.xx - a.ex, a.xz - a.ez);
    a.len = Math.max(0.08, (d1 + d2 + d3 * 2) / 3);
    const turn = dix * dox + diz * doz;
    const junction = this.deg[t]! >= 3;
    a.slow = a.kind === 'ped' ? 1 : junction ? 0.5 : turn < 0.5 ? 0.62 : 1;
  }

  private evaluate(a: Agent, dt: number): void {
    const u = a.u, iu = 1 - u;
    a.x = iu * iu * a.ex + 2 * iu * u * a.cx + u * u * a.xx;
    a.z = iu * iu * a.ez + 2 * iu * u * a.cz + u * u * a.xz;
    let tx = 2 * iu * (a.cx - a.ex) + 2 * u * (a.xx - a.cx);
    let tz = 2 * iu * (a.cz - a.ez) + 2 * u * (a.xz - a.cz);
    const l = Math.hypot(tx, tz);
    if (l > 1e-5) {
      tx /= l; tz /= l;
      // turn smoothly rather than snapping to the new heading
      const k = dt > 0 ? Math.min(1, dt * 9) : 1;
      a.hx += (tx - a.hx) * k;
      a.hz += (tz - a.hz) * k;
      const hl = Math.hypot(a.hx, a.hz) || 1;
      a.hx /= hl; a.hz /= hl;
    }
  }

  // ------------------------------------------------------------------ per frame
  private hide(a: Agent): void {
    this.batch?.visible(a.inst, false);
  }

  update(dt: number, time: number): void {
    const b = this.batch;
    if (!b || !this.state || this.agents.length === 0) return;
    const map = this.map;
    this.replan = 0;
    const ag = this.agents;
    for (let i = 0; i < ag.length; i++) {
      const a = ag[i]!;
      if (a.kind === 'orbit') { this.stepOrbit(a, dt, time); continue; }
      if (a.state === 'wait') {
        a.t += dt;
        if (a.t >= a.waitFor && this.replan < 2) { this.replan++; this.plan(a); }
        continue;
      }
      if (a.state === 'park') {
        a.t += dt;
        a.v *= Math.max(0, 1 - dt * 6);
        if (a.t >= 0.4) { a.state = 'wait'; a.t = 0; a.waitFor = a.kind === 'ped' ? 0.5 + this.rand() * 3 : 0.8 + this.rand() * 3.5; this.hide(a); continue; }
        this.put(a, map, time, 1 - a.t / 0.4);
        continue;
      }
      // follow the car in front: slow to its speed, stop if close
      let vt = a.speed * a.slow;
      if (a.kind !== 'ped') {
        for (let j = 0; j < ag.length; j++) {
          if (j === i) continue;
          const o = ag[j]!;
          if (o.state === 'wait' || o.kind === 'ped' || o.kind === 'orbit' || (o.kind === 'cyclist') !== (a.kind === 'cyclist')) continue;
          const dx = o.x - a.x, dz = o.z - a.z;
          const fwd = dx * a.hx + dz * a.hz;
          if (fwd <= 0 || fwd > 0.42) continue;
          if (Math.abs(dx * a.hz - dz * a.hx) > 0.09 || o.hx * a.hx + o.hz * a.hz < 0.55) continue;
          const room = (fwd - 0.2) / 0.22;
          vt = Math.min(vt, room <= 0 ? 0 : Math.max(o.v, 0.05) * Math.min(1, room));
        }
      }
      a.v += (vt - a.v) * Math.min(1, dt * 4);
      a.u += (a.v * dt) / a.len;
      a.t += dt;
      while (a.u >= 1) {
        a.u -= 1;
        a.k++;
        if (a.k >= a.path.length) {
          a.at = a.path[a.path.length - 1]!;
          a.state = 'park';
          a.t = 0;
          a.u = 1;
          a.k = a.path.length - 1;
          break;
        }
        this.curve(a);
      }
      this.evaluate(a, dt);
      this.put(a, map, time, Math.min(1, a.t / 0.4));
    }
  }

  private stepOrbit(a: Agent, dt: number, time: number): void {
    if (a.state === 'wait') {
      a.t += dt;
      if (a.t >= a.waitFor) {
        if (a.waitFor > 1e8) return;
        a.state = 'go';
        this.batch?.visible(a.inst, true);
      } else return;
    }
    a.oa += (a.speed * dt / a.or) * a.od;
    a.x = a.ox + Math.cos(a.oa) * a.or;
    a.z = a.oz + Math.sin(a.oa) * a.or;
    // tangent of the circle
    a.hx = -Math.sin(a.oa) * a.od;
    a.hz = Math.cos(a.oa) * a.od;
    a.v = a.speed;
    a.phase += dt * 11;
    this.put(a, this.map, time, 1);
  }

  private put(a: Agent, map: MapGeo, _time: number, fade: number): void {
    const b = this.batch!;
    const x = a.x, z = a.z;
    const motor = a.kind === 'car' || a.kind === 'truck' || a.kind === 'bus' || a.kind === 'cart';
    let y = map.driveAt(x, z);
    if (y < 0.03 && a.kind === 'orbit') { b.visible(a.inst, false); a.state = 'wait'; a.waitFor = 1e9; return; }
    y = Math.max(y, 0.02) + (a.kind === 'orbit' ? 0.004 : a.kind === 'ped' ? 0.014 : ASPHALT_LIFT + 0.003);
    // pitch along the grade
    const ahead = map.driveAt(x + a.hx * 0.1, z + a.hz * 0.1);
    const behind = map.driveAt(x - a.hx * 0.1, z - a.hz * 0.1);
    const pitch = motor || a.kind === 'cyclist' ? Math.atan2(ahead - behind, 0.2) * 0.9 : 0;
    // three.js yaw about +y takes +x to (cos, 0, -sin): heading (hx, hz) is yaw = atan2(-hz, hx)
    _q.setFromAxisAngle(_up, Math.atan2(-a.hz, a.hx));
    if (pitch) _q.multiply(_q2.setFromAxisAngle(_az, pitch));
    let sc = a.scale * fade;
    if (a.kind === 'ped' || (a.kind === 'orbit' && a.col !== 1)) {
      // a small walking bob and sway
      const ph = a.kind === 'orbit' ? a.phase : a.phase + (a.k + a.u) * 7;
      y += Math.abs(Math.sin(ph)) * 0.006;
      _q.multiply(_q3.setFromAxisAngle(_ax, Math.sin(ph) * 0.1));
    } else if (a.kind === 'cyclist') {
      _q.multiply(_q3.setFromAxisAngle(_ax, Math.sin((a.k + a.u) * 5) * 0.04));
    } else if (a.kind === 'bus' || a.kind === 'truck') {
      y += Math.sin((a.k + a.u) * 9) * 0.0012;
    }
    sc = Math.max(0.001, sc);
    _m.compose(_p.set(x, y, z), _q, _s.set(sc, sc, sc));
    b.set(a.inst, _m);
  }
}

function orbitPush(list: { x: number; z: number; kind: 'kid' | 'stroll' | 'tractor' }[], x: number, z: number, kind: 'kid' | 'stroll'): void {
  list.push({ x, z, kind });
  list.push({ x, z, kind: kind === 'kid' ? 'stroll' : 'kid' });
}
