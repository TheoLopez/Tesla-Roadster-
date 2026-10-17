import * as THREE from 'three';
import { glowTexture } from './textures.js';

// Faceted wedge supercar in the style of the new Roadster. Car faces -Z.
// Length ~4.5 m, width ~2.0 m, height ~1.15 m, wheelbase 2.7 m.
export const PAINTS = {
  white: { name: 'Blanco Perla', color: 0xeeeeea, metalness: 0.1, roughness: 0.32 },
  red: { name: 'Rojo Multicapa', color: 0x9e0610, metalness: 0.5, roughness: 0.28 },
  black: { name: 'Negro Sólido', color: 0x0b0c0e, metalness: 0.35, roughness: 0.24 },
  blue: { name: 'Azul Profundo', color: 0x0f2a6b, metalness: 0.55, roughness: 0.3 },
  silver: { name: 'Plata Quicksilver', color: 0x8d9297, metalness: 0.9, roughness: 0.26 },
};

const WHEEL_R = 0.37;
const TRACK = 0.84;
const AXLES = [-1.32, 1.38];
const ARCH_R = 0.45;

// Body cross-sections from nose to tail. Each row is one station along Z:
// z, floor, black band top, crease height, crease width, belt height, belt width,
// upper edge width, upper edge height, centre height.
// The right half of each section runs floor centre -> sill -> black band -> crease -> belt -> upper edge -> centre.
const SECTIONS = [
  [-2.26, 0.24, 0.27, 0.33, 0.78, 0.38, 0.72, 0.4, 0.385, 0.38],
  [-2.16, 0.17, 0.25, 0.4, 0.92, 0.47, 0.86, 0.46, 0.47, 0.455],
  [-1.95, 0.14, 0.27, 0.5, 0.97, 0.63, 0.92, 0.5, 0.58, 0.55],
  [-1.32, 0.14, 0.3, 0.7, 0.99, 0.88, 0.93, 0.52, 0.76, 0.7],
  [-1.02, 0.14, 0.31, 0.68, 0.99, 0.86, 0.93, 0.6, 0.84, 0.8],
  [-0.62, 0.14, 0.32, 0.66, 0.99, 0.84, 0.93, 0.66, 0.99, 1.01],
  [-0.3, 0.14, 0.33, 0.65, 0.99, 0.83, 0.93, 0.66, 1.11, 1.13],
  [0.2, 0.14, 0.35, 0.66, 1.0, 0.84, 0.94, 0.65, 1.13, 1.15],
  [0.62, 0.14, 0.38, 0.68, 1.0, 0.86, 0.95, 0.64, 1.07, 1.06],
  [0.98, 0.14, 0.42, 0.72, 1.0, 0.89, 0.96, 0.63, 1.0, 0.95],
  [1.38, 0.15, 0.46, 0.75, 1.01, 0.92, 0.97, 0.62, 0.97, 0.9],
  [1.9, 0.18, 0.5, 0.74, 1.0, 0.92, 0.96, 0.6, 0.95, 0.87],
  [2.22, 0.25, 0.52, 0.72, 0.96, 0.9, 0.92, 0.56, 0.92, 0.86],
];
const NOSE_Z = SECTIONS[0][0];
const TAIL_Z = SECTIONS[SECTIONS.length - 1][0];

function sectionAt(z) {
  for (let i = 1; i < SECTIONS.length; i++) {
    if (z <= SECTIONS[i][0]) {
      const a = SECTIONS[i - 1], b = SECTIONS[i];
      const t = (z - a[0]) / (b[0] - a[0]);
      return a.map((v, k) => v + (b[k] - v) * t);
    }
  }
  return SECTIONS[SECTIONS.length - 1].slice();
}

// Right-half outline of a section, with the wheel arches cut out of the lower body.
function outline(z) {
  const [, floor, band, creaseY, creaseW, beltY, beltW, upW, upY, top] = sectionAt(z);
  let sill = floor;
  for (const zc of AXLES) {
    const dz = Math.abs(z - zc);
    if (dz < ARCH_R) sill = Math.max(sill, WHEEL_R + Math.sqrt(ARCH_R * ARCH_R - dz * dz));
  }
  const bandY = Math.max(band, sill + 0.04);
  const cY = Math.max(creaseY, bandY + 0.06);
  const bY = Math.max(beltY, cY + 0.05);
  return [
    [0, floor],
    [0.6, floor],
    [0.86, sill],
    [0.9, bandY],
    [creaseW, cY],
    [beltW, bY],
    [upW, Math.max(upY, top - 0.12)],
    [0, top],
  ];
}

// Stations along the car: the table plus dense stations around each wheel arch.
function stations() {
  const zs = new Set(SECTIONS.map((s) => s[0]));
  for (const zc of AXLES) {
    for (const f of [-1, -0.999, -0.95, -0.85, -0.7, -0.5, -0.25, 0, 0.25, 0.5, 0.7, 0.85, 0.95, 0.999, 1]) zs.add(+(zc + f * ARCH_R).toFixed(4));
  }
  return [...zs].sort((a, b) => a - b);
}

// Which material each outline segment uses, by segment index (0 floor ... 6 roof) and position.
function segmentMaterial(seg, zMid) {
  if (seg <= 2) return 'black';
  if (seg === 5 && zMid > -0.55 && zMid < 0.62) return 'glass';
  if (seg === 6 && zMid > -1.0 && zMid < 1.5) return 'glass';
  return 'paint';
}

// Loft the sections into flat-shaded facets, one geometry per material.
function buildBody() {
  const zs = stations();
  const rings = zs.map((z) => {
    const r = outline(z);
    const left = r.slice(1, 7).reverse().map(([x, y]) => [-x, y]);
    return { z, pts: [...r, ...left] }; // 14 points, closed
  });
  const N = rings[0].pts.length;
  const buckets = { paint: [], glass: [], black: [] };
  const push = (key, a, b, c) => buckets[key].push(...a, ...b, ...c);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    const zMid = (A.z + B.z) / 2;
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      const seg = k <= 6 ? k : 13 - k;
      const key = segmentMaterial(seg, zMid);
      const a = [A.pts[k][0], A.pts[k][1], A.z];
      const b = [A.pts[k2][0], A.pts[k2][1], A.z];
      const c = [B.pts[k2][0], B.pts[k2][1], B.z];
      const d = [B.pts[k][0], B.pts[k][1], B.z];
      push(key, a, c, b);
      push(key, a, d, c);
    }
  }
  // flat end caps
  for (const [ring, sign] of [[rings[0], -1], [rings[rings.length - 1], 1]]) {
    const cy = ring.pts.reduce((s, p) => s + p[1], 0) / N;
    for (let k = 0; k < N; k++) {
      const p = ring.pts[k], q = ring.pts[(k + 1) % N];
      const a = [0, cy, ring.z], b = [p[0], p[1], ring.z], c = [q[0], q[1], ring.z];
      if (sign > 0) push('paint', a, c, b);
      else push('paint', a, b, c);
    }
  }
  const geos = {};
  for (const [key, arr] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    geos[key] = g;
  }
  // make sure the shell faces outwards (side facets on the right must point +X)
  const n = geos.paint.attributes.normal;
  const p = geos.paint.attributes.position;
  let sx = 0;
  for (let i = 0; i < p.count; i++) if (p.getX(i) > 0.95 && p.getY(i) > 0.5 && p.getY(i) < 0.8) sx += n.getX(i);
  if (sx < 0) {
    for (const g of Object.values(geos)) {
      const pos = g.attributes.position.array;
      for (let i = 0; i < pos.length; i += 9) {
        for (let j = 0; j < 3; j++) [pos[i + 3 + j], pos[i + 6 + j]] = [pos[i + 6 + j], pos[i + 3 + j]];
      }
      g.computeVertexNormals();
    }
  }
  return geos;
}

function makeWheel(mats) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  wheel.add(spin);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 48, 1, true), mats.tire);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);
  // low profile sidewalls (open tread cylinder so the rim disc shows)
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.RingGeometry(0.285, WHEEL_R, 48), mats.tire);
    wall.rotation.y = (sx * Math.PI) / 2;
    wall.position.x = sx * 0.15;
    spin.add(wall);
  }
  const shoulder = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.03, 0.035, 10, 48), mats.tire);
  shoulder.rotation.y = Math.PI / 2;
  shoulder.position.x = 0.135;
  spin.add(shoulder);
  // light aero disc with six black twin blades, like the reference wheels
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.29, 48), mats.rimDisc);
  disc.rotation.z = Math.PI / 2;
  spin.add(disc);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.01, 8, 48), mats.rimDark);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = 0.146;
  spin.add(lip);
  const bladeGeo = new THREE.BoxGeometry(0.02, 0.25, 0.035);
  bladeGeo.translate(0, 0.14, 0);
  for (let k = 0; k < 6; k++) {
    for (const off of [-0.09, 0.09]) {
      const bl = new THREE.Mesh(bladeGeo, mats.rimDark);
      bl.position.x = 0.15;
      bl.rotation.x = (k / 6) * Math.PI * 2 + off;
      spin.add(bl);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 24), mats.rimDark);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = 0.152;
  spin.add(hub);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 30), mats.disc);
  brake.rotation.z = Math.PI / 2;
  brake.position.x = 0.04;
  wheel.add(brake);
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.1), mats.caliper);
  caliper.position.set(0.08, 0.12, 0.1);
  wheel.add(caliper);
  return { wheel, spin };
}

function flameMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uPower: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying float vFacing;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uPower; varying vec2 vUv; varying float vFacing;
      void main(){
        // cold gas: dense white vapour at the nozzle that thins out and swirls downstream
        float along = vUv.y;
        float swirl = 0.7 + 0.3 * sin(uTime * 38.0 + vUv.x * 25.0 + along * 18.0);
        float core = pow(smoothstep(0.0, 1.0, along), 1.6);
        vec3 col = mix(uColor, vec3(1.0), core);
        float a = core * swirl * uPower * 0.55 * pow(vFacing, 1.5);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

export function buildRoadster(paintKey = 'white') {
  const paint = PAINTS[paintKey] || PAINTS.white;
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: paint.color, metalness: paint.metalness, roughness: paint.roughness, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x120d09, metalness: 0.15, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.8, transparent: true, opacity: 0.93 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.55, metalness: 0.2 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x111214, roughness: 0.35, metalness: 0.4, clearcoat: 0.6 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.9 }),
    rimDisc: new THREE.MeshPhysicalMaterial({ color: 0xd9d9d6, metalness: 0.3, roughness: 0.3, clearcoat: 0.5 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.6, roughness: 0.35 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.45 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.5, roughness: 0.4 }),
    headlight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 4 }),
    taillight: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 3 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 1, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.85 }),
    alcantara: new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.95 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x100000, emissive: 0xff2a2a, emissiveIntensity: 1.4 }),
  };

  const group = new THREE.Group();
  const chassis = new THREE.Group(); // body: gets roll / pitch / heave from the suspension
  group.add(chassis);

  const geos = buildBody();
  const body = new THREE.Mesh(geos.paint, mats.paint);
  body.castShadow = true;
  body.receiveShadow = true;
  const glass = new THREE.Mesh(geos.glass, mats.glass);
  glass.castShadow = true;
  const lower = new THREE.Mesh(geos.black, mats.black);
  lower.castShadow = true;
  chassis.add(body, glass, lower);
  // dark inner wheel wells / floor pan so the arches never show daylight through the car
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.36, 3.7), mats.black);
  tub.position.set(0, 0.36, 0.05);
  chassis.add(tub);

  const slab = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    chassis.add(m);
    return m;
  };
  const front = outline(NOSE_Z), rear = outline(TAIL_Z);
  // front: full-width light blade along the wedge edge + sharp black splitter
  slab(front[5][0] * 2 - 0.08, 0.014, 0.02, mats.headlight, 0, front[5][1] - 0.02, NOSE_Z - 0.005);
  slab(1.45, 0.025, 0.14, mats.carbon, 0, 0.17, NOSE_Z + 0.06);
  // hood vents in front of the windscreen
  for (const sx of [-1, 1]) slab(0.3, 0.008, 0.12, mats.black, sx * 0.28, 0.745, -1.2, -0.32, 0, 0);
  // rear: thin full-width light bar, black diffuser with the cold gas thruster cluster
  slab(rear[5][0] * 2 - 0.06, 0.022, 0.02, mats.taillight, 0, rear[5][1] - 0.1, TAIL_Z + 0.005);
  slab(1.55, 0.27, 0.05, mats.carbon, 0, 0.4, TAIL_Z + 0.01);
  for (let k = -2; k <= 2; k++) slab(0.015, 0.22, 0.25, mats.carbon, k * 0.3, 0.36, TAIL_Z - 0.05);
  // side door shut lines and a camera pod in place of a mirror
  for (const sx of [-1, 1]) {
    slab(0.006, 0.42, 0.008, mats.black, sx * 0.995, 0.6, -0.86, 0.12, 0, 0);
    slab(0.006, 0.4, 0.008, mats.black, sx * 1.0, 0.62, 0.66, -0.1, 0, 0);
    slab(0.05, 0.035, 0.1, mats.black, sx * 0.95, 0.9, -0.72);
  }

  // cabin interior seen through the tinted glass: seats, dash with red screen, yoke
  slab(1.6, 0.06, 1.6, mats.seat, 0, 0.62, 0.0);
  for (const sx of [-1, 1]) {
    slab(0.5, 0.12, 0.5, mats.seat, sx * 0.4, 0.7, 0.25);
    slab(0.5, 0.55, 0.12, mats.seat, sx * 0.4, 0.95, 0.52, -0.25, 0, 0);
  }
  slab(1.6, 0.14, 0.3, mats.seat, 0, 0.84, -0.7);
  slab(0.5, 0.12, 0.01, mats.screen, -0.25, 0.92, -0.555, -0.35, 0, 0);
  const yoke = new THREE.Group();
  yoke.position.set(-0.4, 0.92, -0.42);
  yoke.rotation.x = -0.35;
  for (const sx of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), mats.alcantara);
    grip.position.x = sx * 0.15;
    yoke.add(grip);
  }
  yoke.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.06), mats.seat));
  chassis.add(yoke);

  // active rear wing on two black struts
  const wing = new THREE.Group();
  wing.position.set(0, 0.92, 1.92);
  const strutGeo = new THREE.BoxGeometry(0.04, 1, 0.12);
  strutGeo.translate(0, 0.5, 0);
  const struts = [];
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(strutGeo, mats.black);
    s.position.x = sx * 0.55;
    s.scale.y = 0.3;
    wing.add(s);
    struts.push(s);
  }
  const blade = new THREE.Group();
  blade.position.y = 0.3;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.035, 0.42), mats.paint);
  top.castShadow = true;
  const under = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.02, 0.38), mats.black);
  under.position.y = -0.025;
  blade.add(top, under);
  for (const sx of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.46), mats.paint);
    plate.position.set(sx * 0.95, -0.04, 0.02);
    blade.add(plate);
  }
  wing.add(blade);
  chassis.add(wing);

  // SpaceX package: cold gas thrusters in the diffuser + lift thrusters under the floor
  const nozzles = [];
  const flames = [];
  const flameMat = flameMaterial(0xdfe6ee);
  const flameGeo = new THREE.ConeGeometry(0.32, 1.8, 24, 1, true);
  flameGeo.rotateX(-Math.PI / 2); // narrow at the nozzle, widening backwards
  flameGeo.translate(0, 0, 0.9);
  for (const sx of [-0.45, -0.15, 0.15, 0.45]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.08, 20, 1, true), mats.nozzle);
    n.rotation.x = Math.PI / 2;
    n.position.set(sx, 0.36, TAIL_Z + 0.06);
    chassis.add(n);
    nozzles.push(n);
    if (Math.abs(sx) < 0.2) {
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.set(sx, 0.36, TAIL_Z + 0.1);
      f.scale.setScalar(0.001);
      chassis.add(f);
      flames.push(f);
    }
  }
  const liftFlames = [];
  const liftGeo = new THREE.ConeGeometry(0.35, 1.3, 20, 1, true); // narrow at the nozzle, widening towards the ground
  liftGeo.translate(0, -0.65, 0);
  for (const [x, z] of [[-0.45, -1.75], [0.45, -1.75], [-0.45, 1.85], [0.45, 1.85]]) {
    const f = new THREE.Mesh(liftGeo, flameMat);
    f.position.set(x, 0.15, z);
    f.scale.setScalar(0.001);
    chassis.add(f);
    liftFlames.push(f);
  }
  const glowTex = glowTexture('rgba(240,244,248,0.9)');
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, depthWrite: false, transparent: true, opacity: 0 }));
  glow.scale.set(5, 2.5, 1);
  glow.position.set(0, 0.1, 0);
  chassis.add(glow);
  const thrustLight = new THREE.PointLight(0xf2f6ff, 0, 10, 2);
  thrustLight.position.set(0, -0.3, 0.5);
  chassis.add(thrustLight);

  // wheels on their own suspension points (outside the chassis so the body can move over them)
  const wheels = [];
  const pivots = [];
  for (const [x, z, front] of [[-TRACK, AXLES[0], true], [TRACK, AXLES[0], true], [-TRACK, AXLES[1], false], [TRACK, AXLES[1], false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    const { wheel, spin } = makeWheel(mats);
    if (x < 0) wheel.rotation.y = Math.PI; // mirror so the rim face points outwards
    pivot.add(wheel);
    group.add(pivot);
    wheels.push({ spin, mirror: x < 0 ? -1 : 1 });
    if (front) pivots.push(pivot);
  }

  const beam = new THREE.SpotLight(0xe8f2ff, 0, 90, 0.5, 0.5, 1.2);
  beam.position.set(0, 0.5, -2.1);
  beam.target.position.set(0, 0, -25);
  group.add(beam, beam.target);

  const blobTex = glowTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.8), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6 }));
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;

  return { group, chassis, wheels, pivots, flames, liftFlames, flameMat, glow, thrustLight, beam, blob, mats, nozzles, blade, struts, yoke };
}

export function setPaint(model, paintKey) {
  const p = PAINTS[paintKey] || PAINTS.white;
  model.mats.paint.color.setHex(p.color);
  model.mats.paint.metalness = p.metalness;
  model.mats.paint.roughness = p.roughness;
}

// ---------------------------------------------------------------- Physics
// Planar dynamics use a bicycle model with saturating tyre forces, load transfer, aero drag and
// downforce from the active wing. Vertical motion (jumps, thrusters) is a separate point mass.
export const ROAD_LIMIT = 7.0;
const G = 21; // vertical gravity is exaggerated for snappier jumps
const JUMP_V = 10.5;
const THRUST_UP = 34;
const MAX_ALT = 9;

const MASS = 1900;
const IZ = 3100;
const CG_F = 1.32; // CG to front axle
const CG_R = 1.38; // CG to rear axle
const WB = CG_F + CG_R;
const CG_H = 0.42;
const MU = 1.45; // sticky track tyres
const C_F = 115000; // cornering stiffness, N/rad
const C_R = 135000;
const P_MAX = 900000; // W
const F_MAX = 27000; // N, traction limited anyway
const REGEN = 3.4 * MASS; // one-pedal regenerative braking, ~0.35 g
const BRAKE_F = 12 * MASS;
const V_LIMIT = 55; // street limiter, ~198 km/h
const V_LIMIT_BOOST = 80; // with the cold gas thrusters, ~288 km/h
const BOOST_THRUST = 9 * MASS;
const PEDAL_DEADZONE = 0.12;

export class Car {
  constructor(paintKey) {
    this.model = buildRoadster(paintKey);
    this.group = this.model.group;
    this.pos = new THREE.Vector3();
    this.box = new THREE.Box3();
    this.reset(4, 0);
  }

  reset(x, z) {
    this.pos.set(x, 0, z);
    this.yaw = 0;
    this.speed = 0; // longitudinal velocity (m/s, + forward)
    this.vLat = 0; // lateral velocity (m/s, + left)
    this.yawRate = 0;
    this.vy = 0; // vertical velocity
    this.grounded = true;
    this.falling = false;
    this.fuel = 1;
    this.steer = 0;
    this.delta = 0;
    this.pedal = 0;
    this.wheelSpin = 0;
    this.thrustLevel = 0;
    this.liftLevel = 0;
    this.liftActive = false;
    this.boosting = false;
    this.braking = false;
    this.airTime = 0;
    this.ax = 0;
    this.ay = 0;
    this.pitch = 0;
    this.pitchV = 0;
    this.roll = 0;
    this.rollV = 0;
    this.heave = 0;
    this.heaveV = 0;
    this.wingAngle = 0.1;
    this.wingHeight = 0.3;
    this.syncGroup();
  }

  get forwardX() { return -Math.sin(this.yaw); }
  get forwardZ() { return -Math.cos(this.yaw); }

  update(dt, input, world) {
    const ev = { jumped: false, landed: 0, scrape: false, fell: null, skid: 0 };
    const wantBoost = input.boost && this.fuel > 0.02;
    this.boosting = false;

    // driver inputs: progressive steering and a one-pedal accelerator
    const steerRate = Math.abs(input.steer) > Math.abs(this.steer) ? 3.2 : 5;
    this.steer += THREE.MathUtils.clamp(input.steer - this.steer, -steerRate * dt, steerRate * dt);
    const pedalTarget = typeof input.throttle === 'number' ? input.throttle : input.throttle ? 1 : 0;
    const pedalRate = pedalTarget > this.pedal ? 4 : 6;
    this.pedal += THREE.MathUtils.clamp(pedalTarget - this.pedal, -pedalRate * dt, pedalRate * dt);

    if (this.grounded && input.jumpPressed && this.fuel >= 0.12) {
      this.vy = JUMP_V;
      this.fuel -= 0.12;
      this.grounded = false;
      ev.jumped = true;
      this.heaveV = -1.2;
    }

    // planar dynamics in small sub-steps for stability of the stiff tyre model
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) this.planarStep(h, input, wantBoost, ev);

    if (this.grounded) {
      if (!this.boosting) this.fuel = Math.min(1, this.fuel + dt * 0.36);
    } else {
      this.vy -= G * dt;
      this.liftActive = false;
      if (!this.falling && input.jump && !input.jumpPressed && this.fuel > 0) {
        // lift thrusters lose authority with altitude, so holding them settles into a hover
        const altFactor = THREE.MathUtils.clamp(1 - this.pos.y / MAX_ALT, 0.2, 1);
        this.vy += (THRUST_UP * altFactor - this.vy * 1.6) * dt;
        this.fuel -= dt * 0.6;
        this.liftActive = true;
      }
      this.airTime += dt;
    }
    this.fuel = Math.max(0, this.fuel);

    const prevY = this.pos.y;
    this.pos.y += this.vy * dt;

    // curbs: a solid wall that reflects the velocity component going into it
    if (Math.abs(this.pos.x) > ROAD_LIMIT) {
      const sgn = Math.sign(this.pos.x);
      this.pos.x = sgn * ROAD_LIMIT;
      const [wx, wz] = this.worldVelocity();
      const nx = Math.sign(wx) === sgn ? -wx * 0.25 : wx;
      const nz = wz * (1 - Math.min(1, dt * 1.6));
      this.setWorldVelocity(nx, nz);
      this.yawRate *= 0.85;
      ev.scrape = this.grounded && Math.hypot(nx, nz) > 3;
    }

    // ground contact
    const solid = world.isSolid(this.pos.x, this.pos.z);
    if (this.grounded && !solid) {
      this.grounded = false;
      this.falling = true;
      this.vy = Math.min(this.vy, 0);
    }
    if (!this.grounded && this.pos.y <= 0) {
      if (solid && prevY >= -0.05 && !this.falling) {
        ev.landed = -this.vy;
        this.pos.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.heaveV -= Math.min(2.2, ev.landed * 0.12);
        this.airTime = 0;
      } else {
        this.falling = true;
        if (this.pos.y < -1.4) ev.fell = world.holeKindAt(this.pos.x, this.pos.z) || 'pit';
      }
    }

    this.updateWing(dt);
    this.wheelSpin += (this.speed * dt) / WHEEL_R;
    this.thrustLevel += ((this.boosting ? 1 : 0) - this.thrustLevel) * Math.min(1, dt * 10);
    const liftTarget = this.liftActive ? 1 : 0;
    this.liftLevel = ev.jumped ? 1 : this.liftLevel + (liftTarget - this.liftLevel) * Math.min(1, dt * 8);
    this.syncGroup(dt);
    return ev;
  }

  // forward is (-sin yaw, -cos yaw); left is (-cos yaw, sin yaw)
  worldVelocity() {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [-s * this.speed - c * this.vLat, -c * this.speed + s * this.vLat];
  }

  setWorldVelocity(wx, wz) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.speed = -s * wx - c * wz;
    this.vLat = -c * wx + s * wz;
  }

  planarStep(h, input, wantBoost, ev) {
    const vx = this.speed, vyL = this.vLat, r = this.yawRate;
    const v = Math.hypot(vx, vyL);
    const q = 0.5 * 1.2 * v * v;
    // aero: drag rises with the wing angle (air brake), downforce from the body plus the wing
    const drag = q * (0.62 + 1.1 * Math.sin(this.wingAngle) * (this.wingHeight / 0.3));
    const downforce = q * (0.35 + 1.6 * Math.min(0.35, this.wingAngle));
    let fx = 0; // longitudinal tyre force
    let thrust = 0;
    this.braking = false;

    if (!this.grounded) {
      // airborne: no tyre forces; the rear thruster still pushes and the lift jets give a little yaw authority
      if (!this.falling && wantBoost && vx < V_LIMIT_BOOST) {
        thrust += BOOST_THRUST * 0.8;
        this.fuel -= h * 0.33;
        this.boosting = true;
      }
      this.yawRate += (this.steer * 0.6 - this.yawRate) * Math.min(1, h * 1.5);
      this.ax = this.falling ? -Math.sign(vx) * 18 : (thrust - drag * Math.sign(vx)) / MASS;
      this.ay = -this.vLat * 0.3;
    } else {
      const limit = wantBoost ? V_LIMIT_BOOST : V_LIMIT;
      if (input.brake) {
        if (vx > 0.5) { fx -= BRAKE_F; this.braking = true; }
        else if (vx > -9) fx -= 0.35 * F_MAX;
      } else if (this.pedal > PEDAL_DEADZONE) {
        const p = (this.pedal - PEDAL_DEADZONE) / (1 - PEDAL_DEADZONE);
        let f = p * Math.min(F_MAX, P_MAX / Math.max(1, Math.abs(vx)));
        if (vx > limit) f = 0;
        else if (vx > limit - 3) f *= (limit - vx) / 3;
        fx += vx < -0.5 ? BRAKE_F * p : f;
      } else if (Math.abs(vx) > 0.2) {
        // lifting off the single pedal regenerates hard, down to a full stop
        const regen = REGEN * (1 - this.pedal / PEDAL_DEADZONE);
        fx -= Math.sign(vx) * Math.min(regen, (Math.abs(vx) / h) * MASS * 0.5);
        if (regen > REGEN * 0.6 && vx > 3) this.braking = true;
      } else {
        this.speed = 0;
        this.vLat *= 0.5;
        this.yawRate *= 0.5;
        this.ax = this.ay = 0;
        return;
      }
      if (wantBoost && vx < limit) {
        thrust += BOOST_THRUST;
        this.fuel -= h * 0.33;
        this.boosting = true;
      }

      // load transfer and traction limit (all-wheel drive)
      const fzTotal = MASS * 9.81 + downforce;
      const fzF = Math.max(0, (MASS * 9.81 * CG_R) / WB - (CG_H * MASS * this.ax) / WB + downforce * 0.45);
      const fzR = Math.max(0, fzTotal - fzF);
      fx = THREE.MathUtils.clamp(fx, -MU * fzTotal, MU * fzTotal);

      // speed sensitive steering keeps the demand near the grip limit
      const vAbs = Math.max(Math.abs(vx), 1);
      const maxDelta = Math.min(0.55, (1.35 * MU * 9.81 * WB) / (vAbs * vAbs));
      this.delta = this.steer * maxDelta;

      let fyF = 0, fyR = 0;
      if (Math.abs(vx) < 2.5) {
        // low speed: kinematic steering without slip
        const rKin = (vx * Math.tan(this.delta)) / WB;
        this.yawRate += (rKin - r) * Math.min(1, h * 20);
        this.vLat *= 1 - Math.min(1, h * 10);
      } else {
        const dir = Math.sign(vx);
        const alphaF = this.delta - Math.atan2(vyL + CG_F * r, Math.abs(vx)) * dir;
        const alphaR = -Math.atan2(vyL - CG_R * r, Math.abs(vx)) * dir;
        const fxR = fx * 0.55;
        const latF = MU * fzF;
        const latR = Math.sqrt(Math.max(0, (MU * fzR) ** 2 - fxR * fxR));
        fyF = THREE.MathUtils.clamp(C_F * alphaF, -latF, latF);
        fyR = THREE.MathUtils.clamp(C_R * alphaR, -latR, latR);
        this.yawRate += ((CG_F * fyF * Math.cos(this.delta) - CG_R * fyR) / IZ) * h;
        // stability control trims excessive body slip so the car stays catchable
        const beta = Math.atan2(vyL, Math.abs(vx));
        if (Math.abs(beta) > 0.1) this.yawRate -= (r - (vx * Math.tan(this.delta)) / WB) * Math.min(1, h * 6);
        const sliding = Math.abs(fyR) >= latR * 0.98 || Math.abs(fyF) >= latF * 0.98;
        if (sliding) ev.skid = Math.max(ev.skid, Math.min(1, v / 25));
      }
      const rolling = Math.abs(vx) > 0.3 ? 0.013 * MASS * 9.81 * Math.sign(vx) : 0;
      this.ax = (fx + thrust - fyF * Math.sin(this.delta) - drag * Math.sign(vx) - rolling) / MASS + vyL * r;
      this.ay = (fyF * Math.cos(this.delta) + fyR) / MASS - vx * r;
    }

    this.speed += this.ax * h;
    this.vLat += this.ay * h;
    this.yaw += this.yawRate * h;
    const [wx, wz] = this.worldVelocity();
    this.pos.x += wx * h;
    this.pos.z += wz * h;
  }

  // Active aero: low drag on straights, more angle in corners, air brake when slowing, tucked in at low speed.
  updateWing(dt) {
    const v = this.speed;
    let angle = 0.1, height = 0.3;
    if (v < 8) { angle = 0; height = 0.06; }
    else if (!this.grounded) { angle = 0.32; height = 0.34; }
    else if (this.braking && v > 12) { angle = 1.05; height = 0.42; }
    else if (Math.abs(this.steer) > 0.25) { angle = 0.26; height = 0.32; }
    else if (v > 38) { angle = 0.03; height = 0.26; }
    const k = Math.min(1, dt * 5);
    this.wingAngle += (angle - this.wingAngle) * k;
    this.wingHeight += (height - this.wingHeight) * k;
  }

  syncGroup(dt = 0) {
    const m = this.model;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    for (const w of m.wheels) w.spin.rotation.x = -this.wheelSpin * w.mirror;
    const visualSteer = Math.sign(this.steer) * Math.max(Math.abs(this.delta), Math.abs(this.steer) * 0.12);
    for (const p of m.pivots) p.rotation.y = visualSteer;
    m.yoke.rotation.z = this.steer * 1.2;

    // body on springs: pitch from longitudinal accel, roll from lateral accel, heave on landings
    if (dt > 0) {
      const pitchT = this.grounded ? THREE.MathUtils.clamp(this.ax * 0.0045, -0.05, 0.04) : THREE.MathUtils.clamp(-this.vy * 0.01, -0.1, 0.1);
      const rollT = this.grounded ? THREE.MathUtils.clamp(-this.ay * 0.0035, -0.05, 0.05) : 0;
      const spring = (val, vel, target) => {
        vel += ((target - val) * 90 - vel * 11) * dt;
        return [val + vel * dt, vel];
      };
      [this.pitch, this.pitchV] = spring(this.pitch, this.pitchV, pitchT);
      [this.roll, this.rollV] = spring(this.roll, this.rollV, rollT);
      [this.heave, this.heaveV] = spring(this.heave, this.heaveV, 0);
      this.heave = THREE.MathUtils.clamp(this.heave, -0.08, 0.06);
    }
    m.chassis.rotation.x = this.pitch;
    m.chassis.rotation.z = this.roll;
    m.chassis.position.y = this.heave;

    // active wing pose
    m.blade.rotation.x = -this.wingAngle;
    m.blade.position.y = this.wingHeight;
    for (const s of m.struts) s.scale.y = Math.max(0.02, this.wingHeight);
    m.blade.rotation.z = -this.steer * 0.06 * Math.min(1, Math.abs(this.speed) / 20);
    m.mats.taillight.emissiveIntensity = this.braking ? 7 : 3;

    const t = performance.now() / 1000;
    m.flameMat.uniforms.uTime.value = t;
    m.flameMat.uniforms.uPower.value = Math.max(this.thrustLevel, this.liftLevel);
    for (const f of m.flames) {
      const s = this.thrustLevel * (0.9 + Math.random() * 0.25);
      f.scale.set(Math.max(0.001, s), Math.max(0.001, s), Math.max(0.001, s * (1 + this.speed / 80)));
    }
    for (const f of m.liftFlames) f.scale.setScalar(Math.max(0.001, this.liftLevel * (0.8 + Math.random() * 0.4)));
    m.glow.material.opacity = this.liftLevel * 0.35;
    m.thrustLight.intensity = (this.liftLevel + this.thrustLevel) * 8;
    for (const n of m.nozzles) n.material.emissiveIntensity = this.thrustLevel * 0.6;

    m.blob.position.set(this.pos.x, 0.02, this.pos.z);
    m.blob.rotation.z = -this.yaw;
    const hgt = Math.max(0, this.pos.y);
    m.blob.material.opacity = this.falling ? 0 : Math.max(0, 0.55 - hgt * 0.05);
    m.blob.scale.setScalar(1 + hgt * 0.08);
  }

  getBox() {
    const c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw));
    const hx = 0.95 * c + 2.15 * s;
    const hz = 2.15 * c + 0.95 * s;
    this.box.min.set(this.pos.x - hx, this.pos.y + 0.12, this.pos.z - hz);
    this.box.max.set(this.pos.x + hx, this.pos.y + 1.15, this.pos.z + hz);
    return this.box;
  }
}
