import * as THREE from 'three';

export const THEMES = {
  day: {
    label: 'Día',
    skyTop: 0x1f5fae, skyHorizon: 0xcfe2f2, skyBottom: 0x9fb4c4,
    sunColor: 0xfff1dc, sunIntensity: 3.4, sunElev: 52, sunAzim: 35,
    hemiSky: 0xbcd7f0, hemiGround: 0x5a554d, hemiIntensity: 1.1,
    fog: 0xc4d6e4, fogNear: 120, fogFar: 760,
    exposure: 0.9, windowLit: 0.04, windowGlow: 0.25, lamps: false, neon: false,
    bloom: 0.18, headlights: false, roadRough: 0.88, stars: 0, sunDisc: 1,
  },
  sunset: {
    label: 'Atardecer',
    skyTop: 0x27315d, skyHorizon: 0xff8a4c, skyBottom: 0x4a2d3a,
    sunColor: 0xffa060, sunIntensity: 2.6, sunElev: 7, sunAzim: -58,
    hemiSky: 0x8f7fb0, hemiGround: 0x3a2a26, hemiIntensity: 0.75,
    fog: 0xd8866a, fogNear: 90, fogFar: 640,
    exposure: 0.95, windowLit: 0.32, windowGlow: 0.7, lamps: true, neon: true,
    bloom: 0.3, headlights: true, roadRough: 0.7, stars: 0.15, sunDisc: 0.8,
  },
  night: {
    label: 'Noche',
    skyTop: 0x01030a, skyHorizon: 0x1a2350, skyBottom: 0x070912,
    sunColor: 0x9ab4ff, sunIntensity: 0.55, sunElev: 38, sunAzim: 140,
    hemiSky: 0x2a3866, hemiGround: 0x0b0b12, hemiIntensity: 0.45,
    fog: 0x0c1028, fogNear: 60, fogFar: 520,
    exposure: 1.05, windowLit: 0.5, windowGlow: 0.85, lamps: true, neon: true,
    bloom: 0.55, headlights: true, roadRough: 0.32, stars: 1, sunDisc: 0.35,
  },
};

export function sunDirection(theme) {
  const el = THREE.MathUtils.degToRad(theme.sunElev);
  const az = THREE.MathUtils.degToRad(theme.sunAzim);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export function createSky(theme) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
      bottom: { value: new THREE.Color(theme.skyBottom) },
      sunDir: { value: sunDirection(theme) },
      sunColor: { value: new THREE.Color(theme.sunColor) },
      sunDisc: { value: theme.sunDisc },
      stars: { value: theme.stars },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor;
      uniform float sunDisc; uniform float stars;
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h,0.0,1.0),0.4));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 18.0 * sunDisc + pow(s, 12.0) * 0.35 * sunDisc + pow(s, 3.0)*0.12);
        if (stars > 0.0 && h > 0.05) {
          vec3 q = floor(d * 420.0);
          float st = step(0.9975, hash(q));
          col += vec3(st) * stars * smoothstep(0.05, 0.4, h) * (0.6 + 0.4*hash(q+3.1));
        }
        // subtle city glow at the horizon
        col += vec3(0.25,0.18,0.12) * exp(-abs(h)*14.0) * stars * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// Build a reflection environment from the sky plus a few bright city "light panels".
export function createEnvironmentMap(renderer, theme) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky = createSky(theme);
  sky.scale.setScalar(0.05);
  envScene.add(sky);
  const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.skyHorizon).multiplyScalar(theme.stars > 0.5 ? 0.6 : 2.2), side: THREE.DoubleSide });
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.7).multiplyScalar(theme.stars > 0.5 ? 3 : 1.5), side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), i % 3 === 0 ? lightMat : panelMat);
    m.position.set(Math.cos(a) * 50, 8, Math.sin(a) * 50);
    m.lookAt(0, 8, 0);
    envScene.add(m);
  }
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), lightMat);
  strip.position.set(0, 40, 0);
  strip.rotation.x = Math.PI / 2;
  envScene.add(strip);
  const rt = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  envScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return rt;
}

export function createLights(theme) {
  const group = new THREE.Group();
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 300;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  group.add(sun, sun.target);
  return { group, hemi, sun, dir: sunDirection(theme) };
}
