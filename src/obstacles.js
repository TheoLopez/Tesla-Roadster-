import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANES } from './levels.js';
import * as T from './textures.js';

const CAR_COLORS = [0xf2f2f2, 0x1b1b1d, 0x7d8288, 0x8c1b1b, 0x1d3f7a, 0xb8b8b2, 0x2f4f3a, 0x3a3f47, 0xe6e1d3, 0x5a2a6a];
const SHIRTS = [0xd94040, 0x3a6fd9, 0xf2f2f2, 0x222222, 0x2fa36b, 0xf2b705, 0xe07a2f, 0x8e44ad, 0x16a3b8, 0xc2185b];
const PANTS = [0x1f2a44, 0x2b2b2b, 0x5b4636, 0x6f7782, 0x223322];
const SKINS = [0xf1c9a5, 0xd9a47e, 0xa86f4c, 0x6b4430, 0xe8b894];
const HAIRS = [0x1a1410, 0x3b2a1e, 0x6b4a2b, 0xc9a35c, 0x888888];

const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

function colorize(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

// ---------------------------------------------------------------- shared materials
const MATS = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0c1014, roughness: 0.08, metalness: 0.3, clearcoat: 1 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.6, metalness: 0.3 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x500000, emissive: 0xff1010, emissiveIntensity: 1 }),
  hazard: new THREE.MeshStandardMaterial({ color: 0x553300, emissive: 0xff9a10, emissiveIntensity: 0 }),
  taxiSign: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1.5 }),
  person: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
  cone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
  cellCore: new THREE.MeshStandardMaterial({ color: 0x062a33, emissive: 0x30e0ff, emissiveIntensity: 3.2, metalness: 0.4, roughness: 0.2 }),
  cellRing: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 2.2 }),
};
const bodyMats = new Map();
function bodyMat(color) {
  if (!bodyMats.has(color)) bodyMats.set(color, new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
  return bodyMats.get(color);
}

// ---------------------------------------------------------------- vehicles (face -Z)
const VEH = {};
function vehicleGeos(kind) {
  if (VEH[kind]) return VEH[kind];
  const body = [], glass = [], tire = [], head = [], tail = [], dark = [], hazard = [], sign = [];
  const at = (g, x, y, z) => g.translate(x, y, z);
  let W, H, L, r, wheels;
  if (kind === 'sedan' || kind === 'taxi') {
    W = 1.84; L = 4.6; H = 1.5; r = 0.33;
    body.push(at(new RoundedBoxGeometry(W, 0.68, L, 3, 0.2), 0, 0.62, 0));
    glass.push(at(new RoundedBoxGeometry(1.62, 0.55, 2.4, 3, 0.18), 0, 1.16, 0.22));
    body.push(at(new RoundedBoxGeometry(1.5, 0.07, 1.6, 2, 0.03), 0, 1.45, 0.28));
    wheels = [[-0.8, -1.45], [0.8, -1.45], [-0.8, 1.4], [0.8, 1.4]];
    if (kind === 'taxi') sign.push(at(new RoundedBoxGeometry(0.6, 0.18, 0.3, 2, 0.05), 0, 1.58, 0.3));
  } else if (kind === 'suv') {
    W = 1.96; L = 4.85; H = 1.85; r = 0.38;
    body.push(at(new RoundedBoxGeometry(W, 0.9, L, 3, 0.22), 0, 0.78, 0));
    glass.push(at(new RoundedBoxGeometry(1.84, 0.62, 3.2, 3, 0.18), 0, 1.5, 0.35));
    body.push(at(new RoundedBoxGeometry(1.8, 0.08, 2.9, 2, 0.03), 0, 1.82, 0.4));
    wheels = [[-0.85, -1.5], [0.85, -1.5], [-0.85, 1.5], [0.85, 1.5]];
  } else if (kind === 'truck') {
    W = 2.5; L = 8.6; H = 3.2; r = 0.5;
    body.push(at(new RoundedBoxGeometry(2.4, 2.2, 2.3, 3, 0.25), 0, 1.65, -3.1));
    glass.push(at(new THREE.BoxGeometry(2.2, 0.75, 0.12), 0, 2.15, -4.26));
    body.push(at(new RoundedBoxGeometry(2.5, 2.4, 6.0, 2, 0.08), 0, 2.0, 1.25));
    dark.push(at(new THREE.BoxGeometry(2.2, 0.35, 8.4), 0, 0.62, -0.1));
    wheels = [[-1.0, -3.0], [1.0, -3.0], [-1.0, 1.6], [1.0, 1.6], [-1.0, 2.8], [1.0, 2.8]];
    hazard.push(at(new THREE.BoxGeometry(0.25, 0.15, 0.06), -1.0, 0.95, 4.33), at(new THREE.BoxGeometry(0.25, 0.15, 0.06), 1.0, 0.95, 4.33));
    hazard.push(at(new THREE.BoxGeometry(0.2, 0.15, 0.06), -1.0, 1.2, -4.28), at(new THREE.BoxGeometry(0.2, 0.15, 0.06), 1.0, 1.2, -4.28));
  } else {
    // bus
    W = 2.55; L = 12; H = 3.3; r = 0.5;
    body.push(at(new RoundedBoxGeometry(W, 2.9, L, 3, 0.25), 0, 1.85, 0));
    glass.push(at(new THREE.BoxGeometry(W + 0.02, 0.95, L - 1.6), 0, 2.35, 0.3));
    glass.push(at(new THREE.BoxGeometry(2.3, 1.3, 0.1), 0, 2.2, -6.0));
    wheels = [[-1.05, -4.0], [1.05, -4.0], [-1.05, 3.6], [1.05, 3.6]];
  }
  for (const [x, z] of wheels) tire.push(at(new THREE.CylinderGeometry(r, r, 0.3, 18).rotateZ(Math.PI / 2), x, r, z));
  const ly = kind === 'truck' || kind === 'bus' ? 0.9 : 0.72;
  for (const sx of [-1, 1]) {
    head.push(at(new THREE.BoxGeometry(0.38, 0.12, 0.06), sx * (W / 2 - 0.32), ly, -L / 2 - 0.01));
    tail.push(at(new THREE.BoxGeometry(0.42, 0.12, 0.06), sx * (W / 2 - 0.3), ly + 0.05, L / 2 + 0.01));
  }
  dark.push(at(new THREE.BoxGeometry(W * 0.62, 0.16, 0.08), 0, ly - 0.2, -L / 2 - 0.02));
  const m = (a) => (a.length ? merge(a) : null);
  VEH[kind] = { W, H, L, body: m(body), glass: m(glass), tire: m(tire), head: m(head), tail: m(tail), dark: m(dark), hazard: m(hazard), sign: m(sign) };
  return VEH[kind];
}

function makeVehicle(kind, color) {
  const v = vehicleGeos(kind);
  const g = new THREE.Group();
  const add = (geo, mat, cast = true) => {
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = cast;
    g.add(mesh);
  };
  add(v.body, bodyMat(kind === 'taxi' ? 0xf2c300 : color));
  add(v.glass, MATS.glass);
  add(v.tire, MATS.tire);
  add(v.head, MATS.head, false);
  add(v.tail, MATS.tail, false);
  add(v.dark, MATS.dark);
  add(v.hazard, MATS.hazard, false);
  add(v.sign, MATS.taxiSign, false);
  return { obj: g, W: v.W, H: v.H, L: v.L };
}

// ---------------------------------------------------------------- people
let PEOPLE = null;
function personVariants() {
  if (PEOPLE) return PEOPLE;
  const r = T.mulberry32(1234);
  PEOPLE = [];
  for (let i = 0; i < 12; i++) {
    const shirt = pick(SHIRTS, r), pants = pick(PANTS, r), skin = pick(SKINS, r), hair = pick(HAIRS, r);
    const torso = colorize(new THREE.CapsuleGeometry(0.17, 0.4, 4, 10).scale(1, 1, 0.72).translate(0, 1.3, 0), shirt);
    const neck = colorize(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8).translate(0, 1.58, 0), skin);
    const head = colorize(new THREE.SphereGeometry(0.115, 14, 10).translate(0, 1.7, 0), skin);
    const hairG = colorize(new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 1.715, 0.01), hair);
    const upper = merge([torso, neck, head, hairG]);
    const legPants = colorize(new THREE.CapsuleGeometry(0.075, 0.7, 4, 8).translate(0, -0.43, 0), pants);
    const shoe = colorize(new THREE.BoxGeometry(0.12, 0.08, 0.24).translate(0, -0.89, -0.04), 0x111111);
    const leg = merge([legPants, shoe]);
    const sleeve = colorize(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8).translate(0, -0.27, 0), shirt);
    const hand = colorize(new THREE.SphereGeometry(0.05, 8, 6).translate(0, -0.55, 0), skin);
    const arm = merge([sleeve, hand]);
    // static "cheering" pose for crowds (arms up), merged into one geometry
    const legs = [leg.clone().translate(-0.1, 0.93, 0), leg.clone().translate(0.1, 0.93, 0)];
    const armL = arm.clone().rotateZ(-2.6).translate(-0.22, 1.5, 0);
    const armR = arm.clone().rotateZ(2.6).translate(0.22, 1.5, 0);
    const cheer = merge([upper, ...legs, armL, armR]);
    PEOPLE.push({ upper, leg, arm, cheer });
  }
  return PEOPLE;
}

function makeWalker(variant) {
  const g = new THREE.Group();
  const up = new THREE.Mesh(variant.upper, MATS.person);
  up.castShadow = true;
  g.add(up);
  const limbs = [];
  for (const [x, y, geo] of [[-0.1, 0.93, variant.leg], [0.1, 0.93, variant.leg], [-0.23, 1.5, variant.arm], [0.23, 1.5, variant.arm]]) {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    const m = new THREE.Mesh(geo, MATS.person);
    m.castShadow = true;
    p.add(m);
    g.add(p);
    limbs.push(p);
  }
  return { obj: g, limbs };
}

// ---------------------------------------------------------------- props
let BARRIER_GEO = null, BARRIER_MAT = null, CONE_GEO = null, CELL = null;
function barrierAssets() {
  if (BARRIER_GEO) return;
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.08); s.lineTo(0.12, 0.3); s.lineTo(0.08, 0.95);
  s.lineTo(-0.08, 0.95); s.lineTo(-0.12, 0.3); s.lineTo(-0.3, 0.08); s.lineTo(-0.3, 0);
  BARRIER_GEO = new THREE.ExtrudeGeometry(s, { depth: 3.6, bevelEnabled: false });
  BARRIER_GEO.translate(0, 0, -1.8);
  BARRIER_GEO.rotateY(Math.PI / 2);
  const p = BARRIER_GEO.attributes.position, uv = BARRIER_GEO.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.8) / 3.6, p.getY(i) / 0.95);
  BARRIER_MAT = new THREE.MeshStandardMaterial({ map: T.barrierTexture(), roughness: 0.8 });
  const cone = colorize(new THREE.ConeGeometry(0.19, 0.68, 16).translate(0, 0.38, 0), 0xff5a00);
  const band = colorize(new THREE.CylinderGeometry(0.115, 0.14, 0.12, 16, 1, true).translate(0, 0.42, 0), 0xf4f4f4);
  const base = colorize(new THREE.BoxGeometry(0.44, 0.05, 0.44).translate(0, 0.025, 0), 0x1a1a1a);
  CONE_GEO = merge([cone, band, base]);
  CELL = {
    core: new THREE.OctahedronGeometry(0.4, 0),
    ring: new THREE.TorusGeometry(0.62, 0.035, 8, 40),
    glow: new THREE.SpriteMaterial({ map: T.glowTexture('rgba(80,230,255,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }),
  };
}

// ---------------------------------------------------------------- manager
export class Obstacles {
  constructor(parent, particles) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.particles = particles;
    this.solids = [];
    this.cones = [];
    this.cells = [];
    this.spawners = [];
    this.crowds = [];
    barrierAssets();
  }

  clear() {
    this.root.clear();
    this.solids = [];
    this.cones = [];
    this.cells = [];
    this.spawners = [];
    for (const c of this.crowds) for (const m of c.meshes) m.dispose();
    this.crowds = [];
  }

  addSolid(e) {
    e.y0 = e.y0 || 0;
    e.vx = e.vx || 0;
    e.vz = e.vz || 0;
    e.alive = true;
    e.active = e.activateD === undefined;
    this.root.add(e.obj);
    e.obj.position.set(e.x, e.y0, e.z);
    this.solids.push(e);
    return e;
  }

  addVehicle(kind, x, d, { dir = -1, speed = 0, activateD, color }) {
    const v = makeVehicle(kind, color ?? CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)]);
    v.obj.rotation.y = dir < 0 ? 0 : Math.PI;
    return this.addSolid({ kind: kind === 'truck' || kind === 'bus' ? 'truck' : 'vehicle', obj: v.obj, x, z: -d, hx: v.W / 2, hz: v.L / 2, h: v.H, vz: speed ? (dir < 0 ? -speed : speed) : 0, activateD, lane: x, moving: !!speed, dir });
  }

  addCell(x, y, d) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(CELL.core, MATS.cellCore);
    const ring = new THREE.Mesh(CELL.ring, MATS.cellRing);
    const glow = new THREE.Sprite(CELL.glow);
    glow.scale.setScalar(2.4);
    g.add(core, ring, glow);
    g.position.set(x, y, -d);
    this.root.add(g);
    this.cells.push({ obj: g, ring, core, x, y, z: -d, taken: false, phase: this.rand() * 6 });
  }

  cellArc(d0, d1, lane, base, peak, n) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.addCell(LANES[lane], base + Math.sin(Math.PI * t) * peak, d0 + (d1 - d0) * t);
    }
  }

  addCone(x, d) {
    const m = new THREE.Mesh(CONE_GEO, MATS.cone);
    m.castShadow = true;
    m.position.set(x, 0, -d);
    m.rotation.y = this.rand() * 6;
    this.root.add(m);
    this.cones.push({ obj: m, x, y: 0, z: -d, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, hit: false, rest: true });
  }

  addBarrier(x, d) {
    const m = new THREE.Mesh(BARRIER_GEO, BARRIER_MAT);
    m.castShadow = true;
    m.receiveShadow = true;
    const g = new THREE.Group();
    g.add(m);
    // blinking warning lamp on top
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), MATS.hazard);
    lamp.position.set(0, 1.02, 0);
    g.add(lamp);
    this.addSolid({ kind: 'barrier', obj: g, x, z: -d, hx: 1.85, hz: 0.32, h: 0.98 });
  }

  addWalkers(dCenter, count, theme) {
    const vars = personVariants();
    for (let i = 0; i < count; i++) {
      const w = makeWalker(vars[Math.floor(this.rand() * vars.length)]);
      const dir = this.rand() < 0.5 ? 1 : -1;
      const speed = 1.1 + this.rand() * 0.7;
      const x = -10 + this.rand() * 20;
      const d = dCenter + (this.rand() - 0.5) * 3;
      w.obj.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      const e = this.addSolid({ kind: 'person', obj: w.obj, x, z: -d, hx: 0.32, hz: 0.32, h: 1.8, vx: dir * speed, limbs: w.limbs, phase: this.rand() * 6, walker: true });
      e.speed = speed;
    }
  }

  addCrowd(d0, d1) {
    const vars = personVariants();
    const area = 15 * (d1 - d0);
    const n = Math.floor(area / 2.2);
    const groups = [vars[0], vars[3], vars[6], vars[9]];
    const per = Math.ceil(n / groups.length);
    const meshes = [];
    const people = [];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (const v of groups) {
      const inst = new THREE.InstancedMesh(v.cheer, MATS.person, per);
      inst.castShadow = true;
      for (let i = 0; i < per; i++) {
        const x = -7.6 + this.rand() * 15.2, d = d0 + this.rand() * (d1 - d0);
        const p = { inst, i, x, z: -d, ry: (this.rand() - 0.5) * 1.2 + (this.rand() < 0.5 ? 0 : Math.PI), phase: this.rand() * 6, s: 0.9 + this.rand() * 0.2 };
        people.push(p);
        dummy.position.set(x, 0, -d);
        dummy.rotation.set(0, p.ry, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        col.setScalar(0.7 + this.rand() * 0.3);
        inst.setColorAt(i, col);
      }
      this.root.add(inst);
      meshes.push(inst);
    }
    // a festival arch with flags over the crowd
    const crowd = { meshes, people, d0, d1, dummy };
    this.crowds.push(crowd);
    const box = new THREE.Group();
    this.addSolid({ kind: 'person', obj: box, x: 0, z: -(d0 + d1) / 2, hx: 7.8, hz: (d1 - d0) / 2 + 0.3, h: 1.95, bonusValue: 3 });
  }

  build(layout, theme, seed) {
    this.clear();
    this.rand = T.mulberry32(seed * 7 + 3);
    const night = theme.stars > 0.5;
    MATS.head.emissiveIntensity = theme.headlights ? (night ? 6 : 3) : 0.6;
    MATS.tail.emissiveIntensity = theme.headlights ? (night ? 5 : 3) : 1.2;
    MATS.taxiSign.emissiveIntensity = night ? 3 : 1.2;
    const r = this.rand;
    const holeLaneD = layout.holes;

    for (const it of layout.items) {
      const d = it.d;
      switch (it.type) {
        case 'barrier':
          for (const lane of it.lanes) this.addBarrier(LANES[lane], d + 2);
          if (it.lanes.length === 4) this.cellArc(d - 12, d + 16, 1 + Math.floor(r() * 2), 1.2, 3, 5);
          break;
        case 'cones':
          for (let i = 0; i < 10; i++) {
            const lane = i % 2 ? 1 : 2;
            this.addCone(LANES[lane] + (r() - 0.5), d + i * 6);
            this.addCone(LANES[lane] + (r() - 0.5) + (i % 2 ? -1.2 : 1.2), d + i * 6 + 0.6);
          }
          for (let i = 0; i < 6; i++) this.addCell(0, 0.9, d + 3 + i * 10);
          break;
        case 'pothole':
          for (const lane of it.lanes) {
            this.addCone(LANES[lane] - 1.4, d - 3);
            this.addCone(LANES[lane] + 1.4, d - 3);
          }
          break;
        case 'sinkhole':
          for (let i = 0; i < 6; i++) this.addCone(-6.5 + i * 2.6, d - 4);
          this.cellArc(d - 8, d + it.len + 8, 1 + Math.floor(r() * 2), 1.5, 3.2, 5);
          break;
        case 'creek':
          this.cellArc(d - 6, d + it.width + 6, 1 + Math.floor(r() * 2), 1.5, Math.min(7, 2.5 + it.width * 0.1), Math.max(5, Math.round(it.width / 6)));
          break;
        case 'jam': {
          const rows = it.rows || 1;
          for (let row = 0; row < rows; row++) {
            for (let lane = 0; lane < 4; lane++) {
              const dir = lane < 2 ? 1 : -1;
              let kind = r() < 0.3 ? 'suv' : r() < 0.15 ? 'taxi' : 'sedan';
              if (it.bus && row === rows - 1 && lane === 2 + Math.floor(r() * 2)) kind = 'bus';
              this.addVehicle(kind, LANES[lane] + (r() - 0.5) * 0.6, d + 4 + row * 8 + (r() - 0.5) * 1.5, { dir });
            }
          }
          this.cellArc(d - 10, d + rows * 8 + 10, 1 + Math.floor(r() * 2), 2.2, 2.8, 4 + rows);
          break;
        }
        case 'truck':
          for (const lane of it.lanes) this.addVehicle('truck', LANES[lane], d + 6 + (r() - 0.5) * 2, { dir: lane < 2 ? 1 : -1, color: pick([0xdddddd, 0x2d4f8a, 0xa02020, 0x333333], r) });
          if (it.lanes.length === 4) this.cellArc(d - 8, d + 20, 2, 4.5, 2.5, 4);
          break;
        case 'traffic': {
          const lanes = [2, 3];
          for (let i = 0; i < it.count; i++) {
            const lane = lanes[i % 2];
            const kind = r() < 0.25 ? 'suv' : r() < 0.15 ? 'taxi' : 'sedan';
            const dd = d + (i / it.count) * 130 + r() * 8;
            this.addVehicle(kind, LANES[lane], dd, { dir: -1, speed: lane === 2 ? 11 : 15, activateD: dd - 230 });
          }
          break;
        }
        case 'oncoming': {
          for (let i = 0; i < it.count; i++) {
            let lane = i % 2;
            if (it.wrongWay && i % 3 === 2) lane = 2 + Math.floor(r() * 2);
            const kind = r() < 0.25 ? 'suv' : r() < 0.15 ? 'taxi' : 'sedan';
            const dd = d + 60 + (i / it.count) * 150;
            this.addVehicle(kind, LANES[lane], dd, { dir: 1, speed: 13 + r() * 5, activateD: dd - 280 });
          }
          break;
        }
        case 'parade':
          this.addCrowd(d, d + it.len);
          this.cellArc(d - 10, d + it.len + 10, 1 + Math.floor(r() * 2), 2.3, 2.5, 5);
          break;
        case 'intersection': {
          const di = d + 8;
          if (it.crowd) {
            this.addWalkers(di - 9.6, 9, theme);
            this.addWalkers(di + 9.6, 9, theme);
          }
          if (it.cross) this.spawners.push({ di, lanes: [-6, -2, 2, 6].map((o, k) => ({ z: -di + o, dir: k < 2 ? 1 : -1, timer: r() * 2 })), started: false, cars: [] });
          break;
        }
        case 'cells':
          if (it.pattern === 'line') for (let i = 0; i < (it.count || 6); i++) this.addCell(LANES[it.lane], 0.9, d + i * 7);
          else if (it.pattern === 'arc') this.cellArc(d, d + 36, it.lane, 1, 4, 7);
          else this.cellArc(d, d + 40, it.lane, 6, 3, 6);
          break;
        default:
          break;
      }
    }

    // moving vehicles stop before static obstacles / holes in their lane
    const statics = this.solids.filter((s) => !s.moving && !s.walker);
    const movers = this.solids.filter((s) => s.moving);
    for (const m of movers) {
      const d0 = -m.z;
      let stop = m.dir < 0 ? Infinity : -Infinity;
      const consider = (dd) => {
        if (m.dir < 0 && dd > d0 && dd < stop) stop = dd;
        if (m.dir > 0 && dd < d0 && dd > stop) stop = dd;
      };
      for (const s of statics) if (Math.abs(s.x - m.x) < s.hx + m.hx) consider(-s.z + (m.dir < 0 ? -s.hz : s.hz));
      for (const h of holeLaneD) if (m.x > h.x0 - 1 && m.x < h.x1 + 1) consider(m.dir < 0 ? h.d0 : h.d1);
      m.stopD = stop === Infinity || stop === -Infinity ? null : stop + (m.dir < 0 ? -(m.hz + 3) : m.hz + 3);
    }
    // queue behind each other per lane
    const byLane = new Map();
    for (const m of movers) {
      const k = `${m.x}|${m.dir}`;
      if (!byLane.has(k)) byLane.set(k, []);
      byLane.get(k).push(m);
    }
    for (const list of byLane.values()) {
      const dir = list[0].dir;
      list.sort((a, b) => (dir < 0 ? -b.z - -a.z : -a.z - -b.z)); // leader first
      for (let i = 1; i < list.length; i++) {
        const lead = list[i - 1], f = list[i];
        if (lead.stopD == null) continue;
        const queue = lead.stopD + (dir < 0 ? -(lead.hz + f.hz + 2) : lead.hz + f.hz + 2);
        if (f.stopD == null || (dir < 0 ? queue < f.stopD : queue > f.stopD)) f.stopD = queue;
        // never start past the queue position
        if (dir < 0 && -f.z > f.stopD) f.stopD = -f.z;
        if (dir > 0 && -f.z < f.stopD) f.stopD = -f.z;
      }
    }
  }

  spawnCross(sp, lane, x) {
    const kind = this.rand() < 0.2 ? 'suv' : this.rand() < 0.2 ? 'taxi' : this.rand() < 0.07 ? 'bus' : 'sedan';
    const v = makeVehicle(kind, CAR_COLORS[Math.floor(this.rand() * CAR_COLORS.length)]);
    v.obj.rotation.y = lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    const e = this.addSolid({ kind: kind === 'bus' ? 'truck' : 'vehicle', obj: v.obj, x, z: lane.z, hx: v.L / 2, hz: v.W / 2, h: v.H, vx: lane.dir * (12 + this.rand() * 5), cross: true });
    sp.cars.push(e);
  }

  update(dt, car, t, invulnerable) {
    const ev = { crash: null, cells: 0, bonus: 0, honk: false, cone: false };
    const carD = -car.pos.z;
    const cz = car.pos.z;
    const blink = Math.sin(t * 9) > 0 ? 3 : 0.1;
    MATS.hazard.emissiveIntensity = blink;

    for (const sp of this.spawners) {
      const near = carD > sp.di - 380 && carD < sp.di + 40;
      if (!near) continue;
      if (!sp.started) {
        sp.started = true;
        for (const lane of sp.lanes) for (let k = 0; k < 2; k++) this.spawnCross(sp, lane, -lane.dir * (20 + this.rand() * 70));
      }
      for (const lane of sp.lanes) {
        lane.timer -= dt;
        if (lane.timer <= 0) {
          lane.timer = 2.4 + this.rand() * 2.6;
          this.spawnCross(sp, lane, -lane.dir * 95);
        }
      }
    }

    const box = car.getBox();
    for (const e of this.solids) {
      if (!e.alive) continue;
      if (!e.active && carD >= e.activateD) e.active = true;
      if (e.active) {
        if (e.vz) {
          e.z += e.vz * dt;
          if (e.stopD != null && ((e.vz < 0 && -e.z >= e.stopD) || (e.vz > 0 && -e.z <= e.stopD))) {
            e.z = -e.stopD;
            e.vz = 0;
          }
        }
        if (e.vx) {
          e.x += e.vx * dt;
          if (e.cross && Math.abs(e.x) > 100) { e.alive = false; this.root.remove(e.obj); continue; }
          if (e.walker) {
            if (Math.abs(e.x) > 10.5) {
              e.x = Math.sign(e.x) * 10.5;
              e.vx = -e.vx;
              e.obj.rotation.y = e.vx > 0 ? -Math.PI / 2 : Math.PI / 2;
            }
          }
        }
      }
      if (e.walker) {
        e.phase += dt * e.speed * 5.2;
        const s = Math.sin(e.phase) * 0.55;
        e.limbs[0].rotation.x = s;
        e.limbs[1].rotation.x = -s;
        e.limbs[2].rotation.x = -s * 0.8;
        e.limbs[3].rotation.x = s * 0.8;
        e.obj.position.y = Math.abs(Math.cos(e.phase)) * 0.04;
      }
      e.obj.position.x = e.x;
      e.obj.position.z = e.z;
      const dz = e.z - cz;
      e.obj.visible = dz > -720 && dz < 100;
      if (e.vz > 0 && dz > 140) { e.alive = false; e.obj.visible = false; continue; }

      if (Math.abs(dz) > 16) continue;
      const ox = Math.abs(e.x - car.pos.x) < e.hx + (box.max.x - box.min.x) / 2;
      const oz = Math.abs(e.z - car.pos.z) < e.hz + (box.max.z - box.min.z) / 2;
      if (ox && oz) {
        const top = e.y0 + e.h;
        if (box.min.y < top) {
          if (!invulnerable && !ev.crash) ev.crash = e;
        } else if (!car.grounded && !e.bonus) {
          e.bonus = true;
          ev.bonus += e.bonusValue || 1;
        }
      } else if ((e.vz || e.vx) && !e.honk && car.grounded && Math.abs(dz) < 5 && Math.abs(e.x - car.pos.x) < 4.6) {
        e.honk = true;
        ev.honk = true;
      }
    }

    // crowd idle animation
    for (const c of this.crowds) {
      const near = -c.d1 - cz < 120 && -c.d0 - cz > -300;
      for (const m of c.meshes) m.visible = -c.d0 - cz < 100 && -c.d1 - cz > -720;
      if (!near) continue;
      const touched = new Set();
      for (const p of c.people) {
        c.dummy.position.set(p.x, Math.max(0, Math.sin(t * 7 + p.phase)) * 0.12, p.z);
        c.dummy.rotation.set(0, p.ry + Math.sin(t * 2 + p.phase) * 0.2, 0);
        c.dummy.scale.setScalar(p.s);
        c.dummy.updateMatrix();
        p.inst.setMatrixAt(p.i, c.dummy.matrix);
        touched.add(p.inst);
      }
      for (const m of touched) m.instanceMatrix.needsUpdate = true;
    }

    // cones
    for (const c of this.cones) {
      const dz = c.z - cz;
      c.obj.visible = dz > -720 && dz < 100;
      if (!c.hit && Math.abs(dz) < 3 && Math.abs(c.x - car.pos.x) < (box.max.x - box.min.x) / 2 + 0.2 && box.min.y < 0.7) {
        c.hit = true;
        c.rest = false;
        const sp = Math.abs(car.speed);
        c.vx = car.forwardX * sp * 0.8 + (c.x - car.pos.x) * 4 + (Math.random() - 0.5) * 3;
        c.vz = car.forwardZ * sp * 0.8;
        c.vy = 3 + sp * 0.12 + Math.random() * 3;
        c.wx = (Math.random() - 0.5) * 18;
        c.wz = (Math.random() - 0.5) * 18;
        ev.cone = true;
      }
      if (!c.rest) {
        c.vy -= 20 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        c.obj.rotation.x += c.wx * dt;
        c.obj.rotation.z += c.wz * dt;
        if (c.y < 0) {
          c.y = 0;
          c.vy *= -0.3;
          c.vx *= 0.6; c.vz *= 0.6; c.wx *= 0.6; c.wz *= 0.6;
          if (Math.abs(c.vy) < 0.8 && Math.hypot(c.vx, c.vz) < 1) {
            c.rest = true;
            c.obj.rotation.x = Math.PI / 2;
            c.y = 0.18;
          }
        }
        c.obj.position.set(c.x, c.y, c.z);
      }
    }

    // energy cells
    const cx = car.pos.x, cy = car.pos.y + 0.6;
    for (const c of this.cells) {
      if (c.taken) continue;
      const dz = c.z - cz;
      c.obj.visible = dz > -500 && dz < 60;
      if (!c.obj.visible) continue;
      c.obj.position.y = c.y + Math.sin(t * 3 + c.phase) * 0.15;
      c.core.rotation.y = t * 2.2 + c.phase;
      c.ring.rotation.x = t * 1.5;
      c.ring.rotation.y = t * 0.9;
      if (Math.abs(dz) < 2.6 && Math.hypot(c.x - cx, c.obj.position.y - cy) < 2.3) {
        c.taken = true;
        c.obj.visible = false;
        ev.cells++;
        this.particles.emit(c.obj.position, 40, { color: 0x50e6ff, speed: 7, spread: 1, up: 1.5, life: 0.7, size: 0.35, gravity: 2 });
      }
    }
    return ev;
  }

  get totalCells() { return this.cells.length; }
}
