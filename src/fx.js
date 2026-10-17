import * as THREE from 'three';

// GPU point particles for sparks, splashes, dust and energy bursts.
export class Particles {
  constructor(max = 1600, additive = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha; uniform float uScale;
        void main(){
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          if (a <= 0.001) discard;
          gl_FragColor = vec4(vColor * ${additive ? 'a * vAlpha' : '1.0'}, a * vAlpha);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(origin, count, { color = 0xffffff, speed = 6, spread = 1, up = 2, life = 0.8, size = 0.3, gravity = 9, drag = 1.5, dir = null, jitter = 0.2 } = {}) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * jitter;
      let vx = (Math.random() - 0.5) * 2 * spread, vy = Math.random() * up, vz = (Math.random() - 0.5) * 2 * spread;
      if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = vx * s;
      this.vel[i * 3 + 1] = vy * s * 0.5 + vy;
      this.vel[i * 3 + 2] = vz * s;
      const v = 0.75 + Math.random() * 0.25;
      this.col[i * 3] = c.r * v; this.col[i * 3 + 1] = c.g * v; this.col[i * 3 + 2] = c.b * v;
      this.size[i] = size * (0.5 + Math.random());
      this.maxLife[i] = this.life[i] = life * (0.6 + Math.random() * 0.6);
      this.grav[i] = gravity;
      this.drag[i] = drag;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); }
}

// Rain streaks that follow the camera (used in stormy levels).
export class Rain {
  constructor(count = 3500) {
    this.count = count;
    const pos = new Float32Array(count * 6);
    this.offsets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.offsets[i * 3] = (Math.random() - 0.5) * 80;
      this.offsets[i * 3 + 1] = Math.random() * 40;
      this.offsets[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.35, depthWrite: false }));
    this.lines.frustumCulled = false;
  }

  update(dt, center, speed) {
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      let y = this.offsets[i * 3 + 1] - dt * 32;
      if (y < 0) y += 40;
      this.offsets[i * 3 + 1] = y;
      let z = this.offsets[i * 3 + 2] + dt * speed;
      if (z > 40) z -= 80;
      this.offsets[i * 3 + 2] = z;
      const x = center.x + this.offsets[i * 3], yy = y, zz = center.z + z;
      p[i * 6] = x; p[i * 6 + 1] = yy; p[i * 6 + 2] = zz;
      p[i * 6 + 3] = x; p[i * 6 + 4] = yy + 0.7; p[i * 6 + 5] = zz - speed * 0.012;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
