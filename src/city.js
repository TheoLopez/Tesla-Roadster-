import * as THREE from 'three';
import * as T from './textures.js';

const CHUNK = 100;
const ROAD_HALF = 8;
const WALK_OUT = 12.5;

// Small helper to accumulate quads into one indexed BufferGeometry.
class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.n = 0; }
  quad(p, n, uv) {
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.nor.push(n[0], n[1], n[2]);
      this.uv.push(uv[i][0], uv[i][1]);
    }
    const b = this.n;
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }
  // horizontal quad facing up
  floor(x0, x1, z0, z1, y, uvScale = 16, uOff = 0) {
    const u = (x) => (x + uOff) / uvScale, v = (z) => -z / uvScale;
    this.quad(
      [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]],
      [0, 1, 0],
      [[u(x0), v(z1)], [u(x1), v(z1)], [u(x1), v(z0)], [u(x0), v(z0)]],
    );
  }
  // axis aligned box walls (no bottom). uv in metres / tile.
  box(cx, y0, cz, w, h, d, { tileW = 1, tileH = 1, uOff = 0, top = null, walls = true }) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    const vh = h / tileH;
    if (walls) {
      // +x face (spans z)
      this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[uOff, 0], [uOff + d / tileW, 0], [uOff + d / tileW, vh], [uOff, vh]]);
      this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[uOff, 0], [uOff + d / tileW, 0], [uOff + d / tileW, vh], [uOff, vh]]);
      this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[uOff, 0], [uOff + w / tileW, 0], [uOff + w / tileW, vh], [uOff, vh]]);
      this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[uOff, 0], [uOff + w / tileW, 0], [uOff + w / tileW, vh], [uOff, vh]]);
    }
    if (top) top.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[0, 0], [w / 8, 0], [w / 8, d / 8], [0, d / 8]]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
  get empty() { return this.n === 0; }
}

// Subtract hole x-ranges from [xMin, xMax] for every z interval and emit floor quads.
function surface(builder, xMin, xMax, dMin, dMax, holes, y, uvScale) {
  const rel = holes.filter((h) => h.x1 > xMin && h.x0 < xMax && h.d1 > dMin && h.d0 < dMax);
  const cuts = new Set([dMin, dMax]);
  for (const h of rel) { cuts.add(Math.max(dMin, h.d0)); cuts.add(Math.min(dMax, h.d1)); }
  const ds = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < ds.length - 1; i++) {
    const a = ds[i], b = ds[i + 1];
    if (b - a < 0.001) continue;
    const mid = (a + b) / 2;
    const active = rel.filter((h) => h.d0 <= mid && h.d1 >= mid).map((h) => [Math.max(xMin, h.x0), Math.min(xMax, h.x1)]).sort((p, q) => p[0] - q[0]);
    let x = xMin;
    for (const [h0, h1] of active) {
      if (h0 > x) builder.floor(x, h0, -b, -a, y, uvScale);
      x = Math.max(x, h1);
    }
    if (x < xMax) builder.floor(x, xMax, -b, -a, y, uvScale);
  }
}

const NEON_WORDS = ['GIGA', 'VOLT', 'PLAID', 'ORBIT', 'NEURAL', 'MARS', 'CYBER', 'HOTEL', 'CAFÉ', 'ARCADE', 'ZERO', 'APEX', 'NOVA', 'SOLAR'];
const NEON_COLORS = ['#ff2a55', '#22e6ff', '#b44dff', '#ffd23f', '#3dff8b', '#ff7a1a'];

export function buildCity(layout, theme, seed) {
  const rand = T.mulberry32(seed);
  const root = new THREE.Group();
  root.name = 'city';
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const holes = layout.holes;
  const creeks = holes.filter((h) => h.kind === 'creek');
  const ints = layout.intersections;
  const dStart = -150, dEnd = layout.length + 320;
  const nChunks = Math.ceil((dEnd - dStart) / CHUNK);
  const chunks = [];
  for (let i = 0; i < nChunks; i++) {
    const g = new THREE.Group();
    g.userData.d0 = dStart + i * CHUNK;
    g.userData.d1 = g.userData.d0 + CHUNK;
    chunks.push(g);
    root.add(g);
  }
  const chunkOf = (d) => chunks[THREE.MathUtils.clamp(Math.floor((d - dStart) / CHUNK), 0, nChunks - 1)];
  const inCreek = (d, m = 0) => creeks.some((c) => d > c.d0 - m && d < c.d1 + m);
  const nearInt = (d, m = 10) => ints.some((i) => Math.abs(d - i) < m);

  // ------------------------------------------------ materials
  const roadTex = keep(T.roadTexture(theme.roadRough < 0.5));
  const roadMat = keep(new THREE.MeshStandardMaterial({ map: roadTex, roughness: theme.roadRough, metalness: theme.roadRough < 0.5 ? 0.25 : 0.05 }));
  const asphTex = keep(T.plainAsphaltTexture());
  const asphMat = keep(new THREE.MeshStandardMaterial({ map: asphTex, roughness: theme.roadRough, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  const walkTex = keep(T.sidewalkTexture());
  const walkMat = keep(new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.85 }));
  const plazaTex = keep(T.plazaTexture());
  const plazaMat = keep(new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 }));
  const roofTex = keep(T.roofTexture());
  const roofMat = keep(new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.95 }));
  const dirtTex = keep(T.dirtTexture());
  const dirtMat = keep(new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, side: THREE.BackSide }));
  const wallTex = keep(T.concreteWallTexture());
  const wallMat = keep(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, side: THREE.DoubleSide }));
  const hazardTex = keep(T.hazardTexture());
  const hazardMat = keep(new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6, emissive: 0x332200, emissiveMap: hazardTex, emissiveIntensity: theme.lamps ? 0.6 : 0 }));
  const crossTex = keep(T.crosswalkTexture());
  const crossMat = keep(new THREE.MeshStandardMaterial({ map: crossTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, depthWrite: false }));
  const metalMat = keep(new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.8, roughness: 0.4 }));
  const facadeStyles = ['glass', 'concrete', 'modern', 'dark', 'glass', 'concrete', 'modern', 'dark'];
  const facadeMats = facadeStyles.map((st, i) => {
    const { map, emissiveMap } = T.facadeTextures(st, theme.windowLit, seed * 13 + i * 7);
    keep(map); keep(emissiveMap);
    const glassy = st === 'glass' || st === 'dark';
    return keep(new THREE.MeshStandardMaterial({
      map, emissiveMap, emissive: 0xffffff, emissiveIntensity: theme.windowGlow,
      roughness: glassy ? 0.18 : 0.85, metalness: glassy ? 0.65 : 0.05, envMapIntensity: glassy ? 1.4 : 0.6,
    }));
  });
  const storeMats = [0, 1, 2].map((i) => {
    const { map, emissiveMap } = T.storefrontTextures(seed + i * 31, theme.windowLit);
    keep(map); keep(emissiveMap);
    return keep(new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: theme.windowGlow * 0.6, roughness: 0.3, metalness: 0.3 }));
  });

  const perChunk = chunks.map(() => ({ road: new GeoBuilder(), asph: new GeoBuilder(), walk: new GeoBuilder(), plaza: new GeoBuilder(), roof: new GeoBuilder(), fac: facadeMats.map(() => new GeoBuilder()), store: storeMats.map(() => new GeoBuilder()), cross: new GeoBuilder() }));
  const cb = (d) => perChunk[THREE.MathUtils.clamp(Math.floor((d - dStart) / CHUNK), 0, nChunks - 1)];

  // ------------------------------------------------ road + ground surfaces (per chunk)
  for (let i = 0; i < nChunks; i++) {
    const a = dStart + i * CHUNK, b = a + CHUNK;
    surface(perChunk[i].road, -ROAD_HALF, ROAD_HALF, a, b, holes, 0, 16);
    surface(perChunk[i].plaza, -900, -WALK_OUT, a, b, holes, 0.18, 8);
    surface(perChunk[i].plaza, WALK_OUT, 900, a, b, holes, 0.18, 8);
  }

  // sidewalks (raised), cut at intersections and creeks
  const walkCuts = [];
  for (const i of ints) walkCuts.push([i - 8, i + 8]);
  for (const c of creeks) walkCuts.push([c.d0, c.d1]);
  walkCuts.sort((p, q) => p[0] - q[0]);
  {
    let d = dStart;
    const spans = [];
    for (const [c0, c1] of walkCuts) {
      if (c0 > d) spans.push([d, c0]);
      d = Math.max(d, c1);
    }
    if (d < dEnd) spans.push([d, dEnd]);
    for (const [s0, s1] of spans) {
      for (let a = s0; a < s1; a += CHUNK / 2) {
        const b = Math.min(s1, a + CHUNK / 2);
        const B = cb((a + b) / 2);
        for (const sx of [-1, 1]) {
          const xc = sx * (ROAD_HALF + (WALK_OUT - ROAD_HALF) / 2);
          // top
          B.walk.floor(xc - 2.25, xc + 2.25, -b, -a, 0.18, 4);
          // curb face
          const xf = sx * ROAD_HALF;
          if (sx > 0) B.walk.quad([[xf, 0, -b], [xf, 0, -a], [xf, 0.18, -a], [xf, 0.18, -b]], [-1, 0, 0], [[0, 0], [(b - a) / 4, 0], [(b - a) / 4, 0.05], [0, 0.05]]);
          else B.walk.quad([[xf, 0, -a], [xf, 0, -b], [xf, 0.18, -b], [xf, 0.18, -a]], [1, 0, 0], [[0, 0], [(b - a) / 4, 0], [(b - a) / 4, 0.05], [0, 0.05]]);
        }
      }
    }
  }

  // intersections: plain asphalt core, cross streets, crosswalks
  for (const di of ints) {
    const B = cb(di);
    B.asph.floor(-ROAD_HALF, ROAD_HALF, -(di + 8), -(di - 8), 0.004, 8);
    for (const sx of [-1, 1]) {
      // cross street asphalt (rotated markings not needed: plain asphalt + centre line)
      const x0 = sx > 0 ? ROAD_HALF : -120, x1 = sx > 0 ? 120 : -ROAD_HALF;
      B.asph.floor(x0, x1, -(di + 8), -(di - 8), 0.19, 8);
    }
    for (const off of [-9.6, 9.6]) {
      const z = -(di + off);
      B.cross.quad([[-ROAD_HALF, 0.012, z + 1.6], [ROAD_HALF, 0.012, z + 1.6], [ROAD_HALF, 0.012, z - 1.6], [-ROAD_HALF, 0.012, z - 1.6]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }

  // ------------------------------------------------ buildings
  const storeSides = [];
  const neonSpots = [];
  const blocks = [];
  {
    const cuts = [[-1e9, dStart]];
    for (const i of ints) cuts.push([i - 11, i + 11]);
    for (const c of creeks) cuts.push([c.d0 - 14, c.d1 + 14]);
    cuts.push([dEnd, 1e9]);
    cuts.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k][1], b = cuts[k + 1][0];
      if (b - a > 8) blocks.push([a, b]);
    }
  }
  const heightScale = theme.stars > 0.5 ? 1.35 : 1;
  for (const [a, b] of blocks) {
    for (const sx of [-1, 1]) {
      let d = a + 1;
      while (d < b - 6) {
        const w = Math.min(b - d - 1, 10 + rand() * 18);
        if (w < 6) break;
        const depth = 14 + rand() * 12;
        const tall = rand() < 0.12;
        const h = (tall ? 70 + rand() * 90 : 12 + rand() * 48) * heightScale;
        const xc = sx * (WALK_OUT + 1 + depth / 2);
        const zc = -(d + w / 2);
        const mi = Math.floor(rand() * facadeMats.length);
        const B = cb(d + w / 2);
        const uOff = Math.floor(rand() * 8) / 8;
        B.fac[mi].box(xc, 0, zc, depth, h, w, { tileW: T.FACADE_TILE_W, tileH: T.FACADE_TILE_H, uOff, top: B.roof });
        // ground floor storefront on the road side
        const sm = Math.floor(rand() * storeMats.length);
        const xs = sx * (WALK_OUT + 0.96);
        if (sx < 0) B.store[sm].quad([[xs, 0.18, -d - 0.3], [xs, 0.18, -d - w + 0.3], [xs, 4.4, -d - w + 0.3], [xs, 4.4, -d - 0.3]], [1, 0, 0], [[0, 0], [w / 12, 0], [w / 12, 1], [0, 1]]);
        else B.store[sm].quad([[xs, 0.18, -d - w + 0.3], [xs, 0.18, -d - 0.3], [xs, 4.4, -d - 0.3], [xs, 4.4, -d - w + 0.3]], [-1, 0, 0], [[0, 0], [w / 12, 0], [w / 12, 1], [0, 1]]);
        storeSides.push({ x: xs, d: d + w / 2, w, sx });
        if (h > 25 && rand() < 0.5) neonSpots.push({ x: sx * (WALK_OUT + 0.9), y: 8 + rand() * Math.min(25, h - 14), d: d + w / 2, sx, w });
        // roof clutter
        if (rand() < 0.6) {
          const n = 1 + Math.floor(rand() * 3);
          for (let k = 0; k < n; k++) {
            const bw = 2 + rand() * 4, bd = 2 + rand() * 4, bh = 1.2 + rand() * 3;
            B.roof.box(xc + (rand() - 0.5) * (depth - bw - 1), h, zc + (rand() - 0.5) * (w - bd - 1), bw, bh, bd, { tileW: 8, tileH: 8, top: B.roof });
          }
        }
        // back row (taller), seen above the front row
        if (rand() < 0.85) {
          const d2 = 16 + rand() * 18, w2 = Math.max(6, w - rand() * 4), h2 = (20 + rand() * 80) * heightScale;
          const xc2 = sx * (WALK_OUT + 1 + depth + 4 + d2 / 2);
          const mi2 = Math.floor(rand() * facadeMats.length);
          B.fac[mi2].box(xc2, 0, zc, d2, h2, w2, { tileW: T.FACADE_TILE_W, tileH: T.FACADE_TILE_H, uOff: Math.floor(rand() * 8) / 8, top: B.roof });
        }
        d += w + rand() * 2.5;
      }
    }
  }

  // ------------------------------------------------ emit chunk meshes
  perChunk.forEach((B, i) => {
    const g = chunks[i];
    const add = (builder, mat, cast = false) => {
      if (builder.empty) return;
      const geo = keep(builder.build());
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      m.castShadow = cast;
      g.add(m);
    };
    add(B.road, roadMat);
    add(B.asph, asphMat);
    add(B.walk, walkMat);
    add(B.plaza, plazaMat);
    add(B.cross, crossMat);
    add(B.roof, roofMat, true);
    B.fac.forEach((fb, k) => add(fb, facadeMats[k], true));
    B.store.forEach((sb, k) => add(sb, storeMats[k]));
  });

  // ------------------------------------------------ pits
  const pitGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const rubbleGeo = keep(new THREE.DodecahedronGeometry(0.5, 0));
  const rubbleMat = keep(new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.9, flatShading: true }));
  for (const h of holes.filter((x) => x.kind === 'pit')) {
    const w = h.x1 - h.x0, l = h.d1 - h.d0;
    const pit = new THREE.Mesh(pitGeo, dirtMat);
    pit.scale.set(w, 6, l);
    pit.position.set((h.x0 + h.x1) / 2, -3 + 0.001, -(h.d0 + h.d1) / 2);
    pit.receiveShadow = true;
    chunkOf((h.d0 + h.d1) / 2).add(pit);
    // broken asphalt chunks around the rim
    const n = Math.floor((w + l) * 0.9);
    for (let k = 0; k < n; k++) {
      const r = new THREE.Mesh(rubbleGeo, rubbleMat);
      const onX = rand() < 0.5;
      const x = onX ? h.x0 + rand() * w : (rand() < 0.5 ? h.x0 : h.x1);
      const d = onX ? (rand() < 0.5 ? h.d0 : h.d1) : h.d0 + rand() * l;
      if (Math.abs(x) > 7.9) continue;
      r.position.set(x, -0.05, -d);
      r.scale.set(0.3 + rand() * 0.6, 0.15 + rand() * 0.2, 0.3 + rand() * 0.6);
      r.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      chunkOf(d).add(r);
    }
  }

  // ------------------------------------------------ creeks (broken bridges)
  const waterNormal = keep(T.waterNormalTexture());
  waterNormal.repeat.set(60, 4);
  const waterMat = keep(new THREE.MeshPhysicalMaterial({
    color: theme.stars > 0.5 ? 0x0a1a24 : 0x1d4a55, roughness: 0.06, metalness: 0.1,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 1, envMapIntensity: 1.4,
  }));
  const rebarMat = keep(new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.7, metalness: 0.6 }));
  const rebarGeo = keep(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6));
  const rockGeo = keep(new THREE.DodecahedronGeometry(1, 1));
  const rockMat = keep(new THREE.MeshStandardMaterial({ color: 0x4a4740, roughness: 0.95, flatShading: true }));
  const reedGeo = keep(new THREE.ConeGeometry(0.4, 2.2, 5));
  const reedMat = keep(new THREE.MeshStandardMaterial({ color: 0x3d5a2a, roughness: 0.9 }));
  for (const c of creeks) {
    const l = c.d1 - c.d0, zc = -(c.d0 + c.d1) / 2;
    const g = chunkOf((c.d0 + c.d1) / 2);
    const water = new THREE.Mesh(keep(new THREE.PlaneGeometry(1800, l)), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -3.4, zc);
    g.add(water);
    const bed = new THREE.Mesh(keep(new THREE.PlaneGeometry(1800, l)), rockMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -7, zc);
    g.add(bed);
    for (const [d, dir] of [[c.d0, 1], [c.d1, -1]]) {
      const wall = new THREE.Mesh(keep(new THREE.PlaneGeometry(1800, 7.4)), wallMat);
      wall.position.set(0, -3.5, -d);
      wall.rotation.y = dir > 0 ? Math.PI : 0;
      g.add(wall);
      // broken slab edge with hazard stripes
      const slab = new THREE.Mesh(keep(new THREE.BoxGeometry(16.2, 0.8, 0.5)), hazardMat);
      slab.position.set(0, -0.4, -(d + dir * -0.25));
      g.add(slab);
      for (let k = 0; k < 18; k++) {
        const r = new THREE.Mesh(rebarGeo, rebarMat);
        r.position.set(-7.6 + k * 0.9, -0.3 - rand() * 0.3, -(d + dir * 0.5));
        r.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.6);
        g.add(r);
      }
      // bank railings beyond the road
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(keep(new THREE.BoxGeometry(200, 0.08, 0.08)), metalMat);
        rail.position.set(sx * (WALK_OUT + 100), 1.1, -(d - dir * 0.3));
        g.add(rail);
      }
    }
    for (let k = 0; k < 26; k++) {
      const r = new THREE.Mesh(rockGeo, rockMat);
      r.position.set((rand() - 0.5) * 140, -3.6, zc + (rand() - 0.5) * l * 0.9);
      r.scale.set(0.6 + rand() * 1.8, 0.4 + rand(), 0.6 + rand() * 1.8);
      g.add(r);
    }
    for (let k = 0; k < 40; k++) {
      const r = new THREE.Mesh(reedGeo, reedMat);
      const side = rand() < 0.5 ? c.d0 + 1 + rand() * 2 : c.d1 - 1 - rand() * 2;
      r.position.set((rand() < 0.5 ? -1 : 1) * (10 + rand() * 120), -2.6, -side);
      r.scale.setScalar(0.5 + rand());
      g.add(r);
    }
  }

  // ------------------------------------------------ instanced props: lamps, trees, signs
  const dummy = new THREE.Object3D();
  const lampSpots = [];
  for (let d = dStart + 10; d < dEnd; d += 34) {
    if (inCreek(d, 3) || nearInt(d, 11)) continue;
    lampSpots.push({ d, sx: 1 }, { d: d + 17, sx: -1 });
  }
  const poleGeo = keep(new THREE.CylinderGeometry(0.09, 0.13, 8.5, 8));
  poleGeo.translate(0, 4.25, 0);
  const armGeo = keep(new THREE.BoxGeometry(2.6, 0.12, 0.18));
  armGeo.translate(-1.3, 8.4, 0);
  const headGeo = keep(new THREE.BoxGeometry(0.9, 0.12, 0.38));
  headGeo.translate(-2.4, 8.3, 0);
  const lampHeadMat = keep(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0d0, emissiveIntensity: theme.lamps ? 6 : 0.2 }));
  const valid = lampSpots.filter((s) => !inCreek(s.d, 3) && !nearInt(s.d, 11));
  const poles = new THREE.InstancedMesh(poleGeo, metalMat, valid.length);
  const arms = new THREE.InstancedMesh(armGeo, metalMat, valid.length);
  const heads = new THREE.InstancedMesh(headGeo, lampHeadMat, valid.length);
  valid.forEach((s, i) => {
    dummy.position.set(s.sx * (ROAD_HALF + 0.9), 0.18, -s.d);
    dummy.rotation.set(0, s.sx > 0 ? 0 : Math.PI, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    arms.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
  });
  poles.castShadow = arms.castShadow = true;
  root.add(poles, arms, heads);

  // fake light pools under lamps (cheap and pretty at night)
  if (theme.lamps) {
    const poolTex = keep(T.glowTexture('rgba(255,215,160,0.55)', 'rgba(255,200,140,0)'));
    const poolMat = keep(new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: theme.stars > 0.5 ? 0.9 : 0.45 }));
    const poolGeo = keep(new THREE.PlaneGeometry(13, 13));
    poolGeo.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, valid.length);
    valid.forEach((s, i) => {
      dummy.position.set(s.sx * (ROAD_HALF - 1.5), 0.03, -s.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      pools.setMatrixAt(i, dummy.matrix);
    });
    pools.renderOrder = 2;
    root.add(pools);
  }

  // trees
  const treeSpots = [];
  for (let d = dStart + 4; d < dEnd; d += 13 + rand() * 6) {
    for (const sx of [-1, 1]) {
      if (inCreek(d, 4) || nearInt(d, 11) || rand() < 0.25) continue;
      if (valid.some((s) => Math.abs(s.d - d) < 3 && s.sx === sx)) continue;
      treeSpots.push({ d, sx });
    }
  }
  const trunkGeo = keep(new THREE.CylinderGeometry(0.12, 0.18, 3, 6));
  trunkGeo.translate(0, 1.5, 0);
  const crownGeo = keep(new THREE.IcosahedronGeometry(1.7, 1));
  crownGeo.translate(0, 4, 0);
  const trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }));
  const crownMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }));
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
  const col = new THREE.Color();
  treeSpots.forEach((s, i) => {
    const sc = 0.8 + rand() * 0.5;
    dummy.position.set(s.sx * (WALK_OUT - 1.2), 0.18, -s.d);
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.scale.set(sc, sc * (0.9 + rand() * 0.3), sc);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.25 + rand() * 0.08, 0.45, 0.2 + rand() * 0.1);
    crowns.setColorAt(i, col);
  });
  dummy.scale.set(1, 1, 1);
  trunks.castShadow = crowns.castShadow = true;
  root.add(trunks, crowns);

  // traffic lights at intersections
  const tlMats = {
    red: keep(new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 4 })),
    green: keep(new THREE.MeshStandardMaterial({ color: 0x003000, emissive: 0x20ff60, emissiveIntensity: 4 })),
  };
  for (const di of ints) {
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.12, 6, 8)), metalMat);
      pole.position.y = 3;
      const arm = new THREE.Mesh(keep(new THREE.BoxGeometry(5, 0.14, 0.14)), metalMat);
      arm.position.set(-2.5, 5.9, 0);
      const box = new THREE.Mesh(keep(new THREE.BoxGeometry(0.4, 1.1, 0.35)), metalMat);
      box.position.set(-4.4, 5.3, 0);
      const lamp = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 10, 8)), sx > 0 ? tlMats.green : tlMats.red);
      lamp.position.set(-4.4, sx > 0 ? 4.95 : 5.6, 0.2);
      g.add(pole, arm, box, lamp);
      g.position.set(sx * (ROAD_HALF + 0.8), 0.18, -(di + sx * 9));
      g.rotation.y = sx > 0 ? 0 : Math.PI;
      chunkOf(di).add(g);
    }
  }

  // warning signs before hazards
  const signTex = keep(T.textTexture('⚠', { color: '#111', glow: null, w: 256, h: 256, font: '700 170px Arial', bg: '#f2b705' }));
  const signMat = keep(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: theme.lamps ? 0.5 : 0 }));
  const signGeo = keep(new THREE.PlaneGeometry(1.2, 1.2));
  for (const h of holes) {
    const d = h.d0 - 45;
    if (nearInt(d, 9) || inCreek(d, 2)) continue;
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6)), metalMat);
      pole.position.y = 1.1;
      const s = new THREE.Mesh(signGeo, signMat);
      s.position.set(0, 2.4, 0.03);
      s.rotation.z = Math.PI / 4;
      g.add(pole, s);
      g.position.set(sx * (ROAD_HALF + 0.6), 0.18, -d);
      chunkOf(d).add(g);
    }
  }

  // neon signs
  if (theme.neon) {
    const neonGeo = keep(new THREE.PlaneGeometry(1, 1));
    for (const n of neonSpots) {
      const word = NEON_WORDS[Math.floor(rand() * NEON_WORDS.length)];
      const c = NEON_COLORS[Math.floor(rand() * NEON_COLORS.length)];
      const tex = keep(T.textTexture(word, { color: '#ffffff', glow: c, w: 512, h: 128, font: '800 96px "Helvetica Neue", Arial, sans-serif' }));
      const mat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(c).multiplyScalar(theme.stars > 0.5 ? 3.2 : 1.8), depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      const m = new THREE.Mesh(neonGeo, mat);
      const vertical = rand() < 0.4;
      const len = Math.min(n.w * 0.8, 10);
      if (vertical) {
        m.scale.set(len * 0.6, len * 0.15, 1);
        m.rotation.set(0, n.sx > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2);
      } else {
        m.scale.set(len, len / 4, 1);
        m.rotation.y = n.sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      m.position.set(n.x - n.sx * 0.15, n.y, -n.d);
      chunkOf(n.d).add(m);
    }
  }

  // distant skyline
  {
    const n = 420;
    const skyGeo = keep(new THREE.BoxGeometry(1, 1, 1));
    skyGeo.translate(0, 0.5, 0);
    const { map, emissiveMap } = T.facadeTextures('dark', theme.windowLit * 1.2, seed + 777);
    keep(map); keep(emissiveMap);
    map.repeat.set(2, 3);
    emissiveMap.repeat.set(2, 3);
    const skyMat = keep(new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: theme.windowGlow, roughness: 0.4, metalness: 0.5 }));
    const inst = new THREE.InstancedMesh(skyGeo, skyMat, n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const sx = i % 2 ? 1 : -1;
      const d = dStart + rand() * (dEnd - dStart + 300);
      if (inCreek(d, 25)) continue;
      const x = sx * (75 + rand() * 330);
      const w = 14 + rand() * 30, h = (30 + rand() * 160) * heightScale;
      dummy.position.set(x, 0, -d);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(w, h, 14 + rand() * 30);
      dummy.updateMatrix();
      inst.setMatrixAt(k++, dummy.matrix);
    }
    inst.count = k;
    root.add(inst);
    dummy.scale.set(1, 1, 1);
  }

  // ------------------------------------------------ gates: start, checkpoints, finish
  const gateMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, metalness: 0.7, roughness: 0.25, clearcoat: 1 }));
  const stripRed = keep(new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff1a2a, emissiveIntensity: 5 }));
  const stripCyan = keep(new THREE.MeshStandardMaterial({ color: 0x001820, emissive: 0x30d8ff, emissiveIntensity: 4 }));
  const makeGate = (d, label, strip, big) => {
    const g = new THREE.Group();
    const H = big ? 9 : 7;
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(keep(new THREE.BoxGeometry(0.7, H, 0.7)), gateMat);
      p.position.set(sx * 9.2, H / 2, 0);
      p.castShadow = true;
      const s = new THREE.Mesh(keep(new THREE.BoxGeometry(0.08, H - 0.6, 0.08)), strip);
      s.position.set(sx * 8.84, H / 2, 0.36);
      g.add(p, s);
    }
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(19.1, 1.4, 0.8)), gateMat);
    beam.position.y = H;
    beam.castShadow = true;
    const bs = new THREE.Mesh(keep(new THREE.BoxGeometry(18.4, 0.06, 0.06)), strip);
    bs.position.set(0, H - 0.72, 0.42);
    g.add(beam, bs);
    const tex = keep(T.textTexture(label, { color: '#ffffff', glow: strip === stripRed ? '#ff2a3a' : '#30d8ff', w: 1024, h: 128, font: '300 92px "Helvetica Neue", Arial, sans-serif' }));
    const txt = new THREE.Mesh(keep(new THREE.PlaneGeometry(10, 1.25)), keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })));
    txt.position.set(0, H, 0.42);
    g.add(txt);
    g.position.z = -d;
    chunkOf(d).add(g);
    return g;
  };
  makeGate(0, 'R O A D S T E R', stripRed, true);
  layout.checkpoints.slice(1).forEach((d) => makeGate(d, 'C H E C K P O I N T', stripCyan, false));
  const finishD = layout.length;
  makeGate(finishD, 'M E T A', stripRed, true);
  const checker = keep(T.checkerTexture());
  checker.repeat.set(4, 1);
  const finishLine = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 2)), keep(new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })));
  finishLine.rotation.x = -Math.PI / 2;
  finishLine.position.set(0, 0.015, -finishD);
  chunkOf(finishD).add(finishLine);
  const startLine = finishLine.clone();
  startLine.position.z = 2;
  chunkOf(0).add(startLine);

  const isSolid = (x, z) => {
    const d = -z;
    for (const h of holes) if (x > h.x0 && x < h.x1 && d > h.d0 && d < h.d1) return false;
    return true;
  };
  const holeKindAt = (x, z) => {
    const d = -z;
    for (const h of holes) if (x > h.x0 - 1 && x < h.x1 + 1 && d > h.d0 - 1 && d < h.d1 + 1) return h.kind;
    return null;
  };

  const update = (t, playerD) => {
    waterNormal.offset.set(t * 0.02, t * 0.05);
    for (const c of chunks) c.visible = c.userData.d1 > playerD - 160 && c.userData.d0 < playerD + 760;
  };

  const dispose = () => {
    for (const x of disposables) x.dispose?.();
    root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  };

  return { root, isSolid, holeKindAt, update, dispose };
}
