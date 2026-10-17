import * as THREE from 'three';
import { glowTexture } from './textures.js';

// Car faces -Z. Length ~4.3 m, width ~2.0 m, height ~1.2 m, inspired by the 2nd gen Roadster.
export const PAINTS = {
  white: { name: 'Blanco Perla', color: 0xf0f0ec, metalness: 0.12, roughness: 0.18 },
  red: { name: 'Rojo Multicapa', color: 0x9e0610, metalness: 0.55, roughness: 0.26 },
  black: { name: 'Negro Sólido', color: 0x0b0c0e, metalness: 0.35, roughness: 0.2 },
  blue: { name: 'Azul Profundo', color: 0x0f2a6b, metalness: 0.6, roughness: 0.28 },
  silver: { name: 'Plata Quicksilver', color: 0x8d9297, metalness: 0.95, roughness: 0.22 },
};

const WHEEL_R = 0.355;

const LEN = 4.36;
const HALF_LEN = LEN / 2;

// Smooth interpolation through [u, value] control points.
function curve(points) {
  return (u) => {
    if (u <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [u1, v1] = points[i];
      if (u <= u1) {
        const [u0, v0] = points[i - 1];
        const t = (u - u0) / (u1 - u0);
        return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
      }
    }
    return points[points.length - 1][1];
  };
}

// Side profile and plan view of the body, u = -1 at the nose, +1 at the tail.
// Long low nose, hood dipping between raised front fenders, wide rear haunches and a ducktail.
const BODY_TOP = curve([[-1, 0.38], [-0.92, 0.55], [-0.72, 0.68], [-0.45, 0.76], [-0.2, 0.8], [0.2, 0.83], [0.6, 0.87], [0.88, 0.89], [0.97, 0.85], [1, 0.72]]);
const BODY_BOTTOM = curve([[-1, 0.3], [-0.86, 0.17], [0.86, 0.17], [1, 0.32]]);
const BODY_WIDTH = curve([[-1, 0.5], [-0.86, 0.88], [-0.6, 0.98], [-0.32, 0.93], [0.05, 0.92], [0.4, 0.99], [0.62, 1.03], [0.86, 0.97], [1, 0.8]]);
// hood dip between fenders (front) and haunch swell over the rear wheels, applied on the upper surface
const HOOD_DIP = curve([[-1, 0.02], [-0.8, 0.1], [-0.55, 0.1], [-0.4, 0.0], [1, 0]]);
const HAUNCH = curve([[-1, 0], [0.25, 0], [0.55, 0.05], [0.8, 0.03], [1, 0]]);
// black glass teardrop canopy: windshield starts far forward, long rear glass
const CANOPY_TOP = curve([[-1, 0.76], [-0.6, 1.0], [-0.2, 1.16], [0.2, 1.15], [0.6, 1.04], [1, 0.88]]);
const CANOPY_WIDTH = curve([[-1, 0.6], [-0.45, 0.76], [0.2, 0.74], [0.7, 0.6], [1, 0.42]]);
const CANOPY_Z0 = -0.95, CANOPY_Z1 = 1.8;

const se = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

// Deform a high resolution sphere (poles along Z) into a superellipsoid shaped by profile curves.
function sculpt({ top, bottom, width, z0, z1, ex = 0.32, ey = 0.42, ez = 0.7, tumble = 0.24, pinch = 0.1, crown = null }) {
  const geo = new THREE.SphereGeometry(1, 128, 64);
  geo.rotateX(Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = se(z, ez);
    const zz = z0 + (u + 1) * 0.5 * (z1 - z0);
    const uBody = zz / HALF_LEN;
    const t = top(u, uBody), b = bottom(u, uBody), w = width(u, uBody);
    const yy = se(y, ey), xx = se(x, ex);
    let Y = (t + b) / 2 + yy * (t - b) / 2;
    if (crown) Y += crown(uBody, Math.abs(xx)) * Math.max(0, yy) ** 2;
    const k = 1 - tumble * Math.max(0, yy) ** 2 - pinch * Math.max(0, -yy) ** 2;
    p.setXYZ(i, xx * w * k, Y, zz);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeWheel(mats) {
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  wheel.add(spin);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.27, 40, 1), mats.tire);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);
  const sidewall = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.035, 0.04, 10, 40), mats.tire);
  sidewall.rotation.y = Math.PI / 2;
  sidewall.position.x = 0.13;
  spin.add(sidewall);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.275, 48), mats.rimDark);
  rim.rotation.z = Math.PI / 2;
  spin.add(rim);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 8, 48), mats.rim);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = 0.14;
  spin.add(lip);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.245, 48), mats.rimDark);
  face.rotation.y = Math.PI / 2;
  face.position.x = 0.139;
  spin.add(face);
  // two-tone turbine aero blades
  const bladeGeo = new THREE.BoxGeometry(0.025, 0.2, 0.055);
  for (let k = 0; k < 14; k++) {
    const sp = new THREE.Mesh(bladeGeo, k % 2 ? mats.rim : mats.rimDark);
    const ang = (k / 14) * Math.PI * 2;
    sp.position.set(0.143, Math.cos(ang) * 0.135, Math.sin(ang) * 0.135);
    sp.rotation.x = -ang;
    sp.rotation.y = 0.45;
    spin.add(sp);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20), mats.chrome);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = 0.15;
  spin.add(cap);
  // static parts: brake disc + red caliper
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 30), mats.disc);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = 0.06;
  wheel.add(disc);
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.09), mats.caliper);
  caliper.position.set(0.09, 0.1, 0.1);
  wheel.add(caliper);
  return { wheel, spin };
}

function flameMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uPower: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uPower; varying vec2 vUv;
      void main(){
        float along = vUv.y;               // 0 tip -> 1 base
        float flick = 0.75 + 0.25*sin(uTime*60.0 + vUv.x*30.0);
        float core = smoothstep(0.0, 1.0, along);
        vec3 col = mix(uColor, vec3(1.0), pow(core, 3.0));
        float a = core * flick * uPower;
        gl_FragColor = vec4(col * a * 2.2, a);
      }`,
  });
}

export function buildRoadster(paintKey = 'white') {
  const paint = PAINTS[paintKey] || PAINTS.white;
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({
      color: paint.color,
      metalness: paint.metalness,
      roughness: paint.roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.2,
    }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x050608, metalness: 0.2, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.45, metalness: 0.3 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x111214, roughness: 0.35, metalness: 0.4, clearcoat: 0.6 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.95, roughness: 0.22 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.8, roughness: 0.4 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.1 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.45 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xd01020, metalness: 0.3, roughness: 0.4 }),
    headlight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfefff, emissiveIntensity: 4 }),
    taillight: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 3 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x222, metalness: 1, roughness: 0.3, emissive: 0x0050ff, emissiveIntensity: 0 }),
  };

  const group = new THREE.Group();
  const chassis = new THREE.Group(); // gets roll/pitch/suspension
  group.add(chassis);

  const bodyGeo = sculpt({
    top: BODY_TOP, bottom: BODY_BOTTOM, width: BODY_WIDTH, z0: -HALF_LEN, z1: HALF_LEN,
    crown: (u, ax) => -HOOD_DIP(u) * (1 - ax ** 3) + HAUNCH(u) * ax ** 4,
  });
  const body = new THREE.Mesh(bodyGeo, mats.paint);
  body.castShadow = true;
  body.receiveShadow = true;
  chassis.add(body);

  const canopyGeo = sculpt({
    top: CANOPY_TOP,
    bottom: (u, ub) => BODY_TOP(ub) - HOOD_DIP(ub) - 0.1,
    width: CANOPY_WIDTH,
    z0: CANOPY_Z0, z1: CANOPY_Z1, ex: 0.55, ey: 0.62, ez: 0.6, tumble: 0.38, pinch: 0,
  });
  const canopy = new THREE.Mesh(canopyGeo, mats.glass);
  canopy.castShadow = true;
  chassis.add(canopy);

  // removable targa roof panel seams
  for (const z of [-0.2, 0.75]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.01, 0.015), mats.black);
    seam.position.set(0, CANOPY_TOP((z - CANOPY_Z0) / (CANOPY_Z1 - CANOPY_Z0) * 2 - 1) + 0.004, z);
    chassis.add(seam);
  }

  // Lights follow the sculpted surface
  const at = (zWorld) => ({ top: BODY_TOP(zWorld / HALF_LEN), w: BODY_WIDTH(zWorld / HALF_LEN) });
  for (const sx of [-1, 1]) {
    // slim angular headlights set into the leading edge of each fender
    const f = at(-1.88);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.028, 0.1), mats.headlight);
    hl.position.set(sx * f.w * 0.6, f.top - 0.11, -1.88);
    hl.rotation.set(0.4, sx * 0.55, -sx * 0.18);
    chassis.add(hl);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.12), mats.glass);
    lens.position.set(sx * f.w * 0.6, f.top - 0.13, -1.87);
    lens.rotation.copy(hl.rotation);
    chassis.add(lens);
    // sculpted black air scoop on the lower door / rear quarter
    const scoopShape = new THREE.Shape();
    scoopShape.moveTo(0, 0); scoopShape.lineTo(1.05, 0.04); scoopShape.lineTo(0.95, 0.24); scoopShape.lineTo(0.2, 0.08); scoopShape.lineTo(0, 0);
    const scoopGeo = new THREE.ExtrudeGeometry(scoopShape, { depth: 0.04, bevelEnabled: false });
    scoopGeo.rotateY(-Math.PI / 2);
    const scoop = new THREE.Mesh(scoopGeo, mats.black);
    scoop.position.set(sx > 0 ? 0.96 : -0.92, 0.33, -0.15); // geometry spans x in [-0.04, 0]
    chassis.add(scoop);
    // black rocker panel
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.9), mats.black);
    rocker.position.set(sx * 0.86, 0.24, 0.0);
    chassis.add(rocker);
  }
  // thin taillights wrapping the rear corners, joined by a faint light line under the ducktail
  const r = at(2.08);
  for (const sx of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.032, 0.05), mats.taillight);
    tl.position.set(sx * r.w * 0.5, r.top - 0.08, 2.04);
    tl.rotation.set(-0.5, sx * 0.3, 0);
    chassis.add(tl);
  }
  const line = new THREE.Mesh(new THREE.BoxGeometry(r.w * 0.8, 0.008, 0.02), mats.taillight);
  line.position.set(0, r.top - 0.075, 2.11);
  chassis.add(line);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.3), mats.carbon);
  diffuser.position.set(0, 0.25, 1.92);
  chassis.add(diffuser);
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.14), mats.black);
  splitter.position.set(0, 0.19, -1.98);
  chassis.add(splitter);
  // grille-less nose: one wide, low black intake
  const intakeShape = new THREE.Shape();
  intakeShape.moveTo(-0.62, 0); intakeShape.lineTo(0.62, 0); intakeShape.lineTo(0.5, 0.09); intakeShape.lineTo(-0.5, 0.09); intakeShape.lineTo(-0.62, 0);
  const grille = new THREE.Mesh(new THREE.ExtrudeGeometry(intakeShape, { depth: 0.08, bevelEnabled: false }), mats.black);
  grille.position.set(0, 0.25, -2.12);
  chassis.add(grille);

  // SpaceX package: rear cold-gas thruster nozzles hidden behind the plate + lift thrusters
  const nozzles = [];
  const flames = [];
  const flameMat = flameMaterial(0x3aa0ff);
  const flameGeo = new THREE.ConeGeometry(0.11, 1.6, 20, 1, true);
  flameGeo.rotateX(-Math.PI / 2); // tip towards +Z
  flameGeo.translate(0, 0, 0.8);
  for (const sx of [-0.28, 0.28]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 20, 1, true), mats.nozzle);
    n.rotation.x = Math.PI / 2;
    n.position.set(sx, 0.5, 2.13);
    chassis.add(n);
    nozzles.push(n);
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(sx, 0.5, 2.18);
    f.scale.setScalar(0.001);
    chassis.add(f);
    flames.push(f);
  }
  const liftFlames = [];
  const liftGeo = new THREE.ConeGeometry(0.09, 1.1, 16, 1, true);
  liftGeo.rotateX(Math.PI); // tip downward
  liftGeo.translate(0, -0.55, 0);
  for (const [x, z] of [[-0.72, -1.4], [0.72, -1.4], [-0.72, 1.55], [0.72, 1.55]]) {
    const f = new THREE.Mesh(liftGeo, flameMat);
    f.position.set(x, 0.2, z);
    f.scale.setScalar(0.001);
    chassis.add(f);
    liftFlames.push(f);
  }
  const glowTex = glowTexture('rgba(90,170,255,1)');
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  glow.scale.set(5, 2.5, 1);
  glow.position.set(0, 0.1, 0);
  chassis.add(glow);
  const thrustLight = new THREE.PointLight(0x4aa8ff, 0, 14, 2);
  thrustLight.position.set(0, -0.3, 0.5);
  chassis.add(thrustLight);

  // Wheels
  const wheels = [];
  const pivots = [];
  const track = 0.86;
  for (const [x, z, front] of [[-track, -1.3, true], [track, -1.3, true], [-track, 1.3, false], [track, 1.3, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    const { wheel, spin } = makeWheel(mats);
    if (x < 0) wheel.rotation.y = Math.PI; // mirror so rim face points outwards
    pivot.add(wheel);
    group.add(pivot);
    wheels.push({ spin, mirror: x < 0 ? -1 : 1 });
    if (front) pivots.push(pivot);
  }

  // Headlight beam (used at night)
  const beam = new THREE.SpotLight(0xe8f2ff, 0, 90, 0.5, 0.5, 1.2);
  beam.position.set(0, 0.7, -2.0);
  beam.target.position.set(0, 0, -25);
  group.add(beam, beam.target);

  // contact shadow blob for when the car flies
  const blobTex = glowTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6 }));
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;

  return { group, chassis, wheels, pivots, flames, liftFlames, flameMat, glow, thrustLight, beam, blob, mats, nozzles };
}

export function setPaint(model, paintKey) {
  const p = PAINTS[paintKey] || PAINTS.white;
  model.mats.paint.color.setHex(p.color);
  model.mats.paint.metalness = p.metalness;
  model.mats.paint.roughness = p.roughness;
}

// ---------------------------------------------------------------- Physics
export const ROAD_LIMIT = 7.0;
const G = 21;
const JUMP_V = 10.5;
const THRUST_UP = 34;
const MAX_ALT = 9;
const ACCEL = 15.5; // ~0-100 km/h in < 2 s
const BRAKE = 24;
const MAX_SPEED = 52; // ~187 km/h
const BOOST_SPEED = 78; // ~280 km/h
const BOOST_ACC = 13;

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
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.falling = false;
    this.fuel = 1;
    this.steer = 0;
    this.wheelSpin = 0;
    this.thrustLevel = 0;
    this.liftLevel = 0;
    this.boosting = false;
    this.airTime = 0;
    this.pitch = 0;
    this.roll = 0;
    this.squash = 0;
    this.accelSmoothed = 0;
    this.scraping = false;
    this.syncGroup();
  }

  get forwardX() { return -Math.sin(this.yaw); }
  get forwardZ() { return -Math.cos(this.yaw); }

  update(dt, input, world) {
    const ev = { jumped: false, landed: 0, scrape: false, fell: null };
    let accel = 0;
    const wantBoost = input.boost && this.fuel > 0.02;
    this.boosting = false;

    // steering smoothing
    const steerTarget = input.steer;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * (Math.abs(steerTarget) > Math.abs(this.steer) ? 7 : 10));

    if (this.grounded) {
      const vmax = wantBoost ? BOOST_SPEED : MAX_SPEED;
      if (input.throttle) {
        const f = Math.max(0, 1 - (this.speed / vmax) ** 2);
        accel += (this.speed < 0 ? BRAKE : ACCEL * (0.35 + 0.65 * Math.sqrt(f)));
        if (this.speed > vmax) accel -= 6;
      }
      if (input.brake) {
        if (this.speed > 0.5) accel -= BRAKE;
        else if (this.speed > -9) accel -= 7;
      }
      if (wantBoost && input.throttle) {
        accel += BOOST_ACC;
        this.fuel -= dt * 0.33;
        this.boosting = true;
      }
      // rolling resistance + aero drag + regen
      const drag = 0.6 + 0.00045 * this.speed * this.speed + (input.throttle ? 0 : 2.2);
      if (Math.abs(this.speed) > 0.05) accel -= Math.sign(this.speed) * drag;
      else if (!input.throttle && !input.brake) this.speed = 0;
      if (!this.boosting) this.fuel = Math.min(1, this.fuel + dt * 0.36);

      if (input.jumpPressed && this.fuel >= 0.12) {
        this.vy = JUMP_V;
        this.fuel -= 0.12;
        this.grounded = false;
        ev.jumped = true;
        this.squash = -0.12;
      }
    } else {
      // airborne: gravity, lift thrusters, rear thruster for range
      this.vy -= G * dt;
      this.liftActive = false;
      if (!this.falling && input.jump && !input.jumpPressed && this.fuel > 0) {
        // lift thrusters lose authority with altitude, so holding them settles into a hover
        const altFactor = THREE.MathUtils.clamp(1 - this.pos.y / MAX_ALT, 0.2, 1);
        this.vy += (THRUST_UP * altFactor - this.vy * 1.6) * dt;
        this.fuel -= dt * 0.6;
        this.liftActive = true;
      }
      if (!this.falling && wantBoost) {
        accel += BOOST_ACC * 0.8;
        this.fuel -= dt * 0.33;
        this.boosting = true;
      }
      accel -= Math.sign(this.speed) * 0.00035 * this.speed * this.speed;
      if (this.boosting && this.speed > BOOST_SPEED) accel = Math.min(accel, 0);
      this.airTime += dt;
    }
    this.fuel = Math.max(0, this.fuel);
    if (this.falling) accel = -Math.sign(this.speed) * 25;

    this.speed += accel * dt;
    this.accelSmoothed += (accel - this.accelSmoothed) * Math.min(1, dt * 5);

    // yaw
    const sp = Math.abs(this.speed);
    const grip = this.grounded ? 1 : 0.4;
    const yawRate = this.steer * 1.55 * Math.min(1, sp / 7) / (1 + sp / 45) * Math.sign(this.speed || 1) * grip;
    this.yaw += yawRate * dt;
    // self centering at speed keeps the car manageable on a long boulevard
    if (Math.abs(input.steer) < 0.05 && this.grounded) this.yaw -= this.yaw * Math.min(1, dt * 0.6 * Math.min(1, sp / 20));
    this.yaw = THREE.MathUtils.clamp(this.yaw, -0.95, 0.95);

    const prevY = this.pos.y;
    this.pos.x += this.forwardX * this.speed * dt;
    this.pos.z += this.forwardZ * this.speed * dt;
    this.pos.y += this.vy * dt;

    // curbs
    if (Math.abs(this.pos.x) > ROAD_LIMIT) {
      const s = Math.sign(this.pos.x);
      this.pos.x = s * ROAD_LIMIT;
      const headingIn = Math.sign(this.forwardX * this.speed) === s;
      if (headingIn) this.yaw *= -0.3;
      this.speed *= 1 - Math.min(1, dt * 1.4);
      ev.scrape = this.grounded && Math.abs(this.speed) > 3;
    }

    // ground
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
        this.squash = Math.min(0.14, ev.landed * 0.01);
        this.airTime = 0;
      } else {
        this.falling = true;
        if (this.pos.y < -1.4) ev.fell = world.holeKindAt(this.pos.x, this.pos.z) || 'pit';
      }
    }

    // visuals
    this.wheelSpin += (this.grounded ? this.speed : this.speed * 0.98) * dt / WHEEL_R;
    const thrustTarget = this.boosting ? 1 : 0;
    this.thrustLevel += (thrustTarget - this.thrustLevel) * Math.min(1, dt * 10);
    const liftTarget = this.liftActive ? 1 : ev.jumped ? 1 : 0;
    this.liftLevel = ev.jumped ? 1 : this.liftLevel + (liftTarget - this.liftLevel) * Math.min(1, dt * 8);
    this.syncGroup(dt);
    return ev;
  }

  syncGroup(dt = 0) {
    const m = this.model;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    for (const w of m.wheels) w.spin.rotation.x = -this.wheelSpin * w.mirror;
    for (const p of m.pivots) p.rotation.y = this.steer * 0.42;
    const k = Math.min(1, dt * 6);
    const rollT = this.grounded ? -this.steer * Math.min(1, Math.abs(this.speed) / 30) * 0.035 : -this.steer * 0.08;
    const pitchT = this.grounded ? THREE.MathUtils.clamp(this.accelSmoothed * 0.0022, -0.035, 0.03) : THREE.MathUtils.clamp(-this.vy * 0.012, -0.12, 0.12);
    this.roll += (rollT - this.roll) * k;
    this.pitch += (pitchT - this.pitch) * k;
    this.squash += (0 - this.squash) * Math.min(1, dt * 8);
    m.chassis.rotation.z = this.roll;
    m.chassis.rotation.x = this.pitch;
    m.chassis.position.y = -this.squash * 0.6;

    const t = performance.now() / 1000;
    m.flameMat.uniforms.uTime.value = t;
    m.flameMat.uniforms.uPower.value = Math.max(this.thrustLevel, this.liftLevel);
    for (const f of m.flames) {
      const s = this.thrustLevel * (0.9 + Math.random() * 0.25);
      f.scale.set(Math.max(0.001, s), Math.max(0.001, s), Math.max(0.001, s * (1 + this.speed / 80)));
    }
    for (const f of m.liftFlames) {
      const s = this.liftLevel * (0.8 + Math.random() * 0.4);
      f.scale.setScalar(Math.max(0.001, s));
    }
    m.glow.material.opacity = this.liftLevel * 0.9;
    m.thrustLight.intensity = (this.liftLevel + this.thrustLevel) * 25;
    for (const n of m.nozzles) n.material.emissiveIntensity = this.thrustLevel * 3;

    // ground shadow blob (visible mostly when airborne)
    m.blob.position.set(this.pos.x, 0.02, this.pos.z);
    m.blob.rotation.z = -this.yaw;
    const h = Math.max(0, this.pos.y);
    m.blob.material.opacity = this.falling ? 0 : Math.max(0, 0.55 - h * 0.05);
    m.blob.scale.setScalar(1 + h * 0.08);
  }

  getBox() {
    const c = Math.abs(Math.cos(this.yaw)), s = Math.abs(Math.sin(this.yaw));
    const hx = 0.92 * c + 2.05 * s;
    const hz = 2.05 * c + 0.92 * s;
    this.box.min.set(this.pos.x - hx, this.pos.y + 0.12, this.pos.z - hz);
    this.box.max.set(this.pos.x + hx, this.pos.y + 1.15, this.pos.z + hz);
    return this.box;
  }
}
