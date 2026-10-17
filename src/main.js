import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Car, PAINTS, setPaint } from './car.js';
import { buildCity } from './city.js';
import { Obstacles } from './obstacles.js';
import { LEVELS, layoutLevel } from './levels.js';
import { THEMES, createSky, createEnvironmentMap, createLights } from './environment.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Particles, Rain } from './fx.js';
import { setMaxAnisotropy } from './textures.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'roadster-thrust-city-v1';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const QUALITY = {
  ultra: { pr: 2, shadow: 4096, bloom: true, msaa: 8, shadows: true },
  high: { pr: 1.5, shadow: 2048, bloom: true, msaa: 4, shadows: true },
  medium: { pr: 1, shadow: 1024, bloom: true, msaa: 2, shadows: true },
  low: { pr: 0.8, shadow: 512, bloom: false, msaa: 0, shadows: false },
};

function loadSave() {
  const defaults = { unlocked: 1, best: {}, paint: 'white', quality: isTouch ? 'medium' : 'high', music: 0.55, sfx: 0.85, camera: 0 };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

const CRASH_TEXT = {
  vehicle: ['¡CHOQUE!', 'Salta sobre el tráfico con ESPACIO'],
  truck: ['¡CHOQUE!', 'Los camiones son altos: mantén ESPACIO para ganar altura'],
  person: ['¡PEATÓN!', 'Nunca toques a un peatón: salta por encima'],
  barrier: ['¡CHOQUE!', 'Salta las barreras con los propulsores'],
  pit: ['¡HUECO!', 'Los huecos se saltan, no se esquivan a ciegas'],
  creek: ['¡AL AGUA!', 'Más velocidad + ESPACIO sostenido + SHIFT para planear'],
  reset: ['CHECKPOINT', 'Regresando…'],
};

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};

class Game {
  constructor() {
    this.save = loadSave();
    this.input = new Input();
    this.audio = new AudioEngine();
    this.audio.musicVol = this.save.music;
    this.audio.sfxVol = this.save.sfx;
    this.state = 'loading';
    this.t = 0;
    this.camMode = Number(this.save.camera) || 0;
    this.shake = 0;
    this.initRenderer();
    this.initWorld();
    this.initShowroom();
    this.initUI();
    this.last = performance.now();
    requestAnimationFrame(() => this.loop());
    setTimeout(() => {
      $('loading').classList.remove('show');
      this.showScreen('menu');
    }, 350);
  }

  // ------------------------------------------------------------------ setup
  initRenderer() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    $('app').appendChild(r.domElement);
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2500);
    this.applyQuality();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
  }

  applyQuality() {
    const q = QUALITY[this.save.quality] || QUALITY.high;
    this.q = q;
    const pr = Math.min(devicePixelRatio || 1, q.pr);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = q.shadows;
    if (this.composer) this.composer.dispose();
    const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: q.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(innerWidth, innerHeight);
    const prev = this.renderPass;
    this.renderPass = new RenderPass(prev ? prev.scene : new THREE.Scene(), prev ? prev.camera : this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.4, 0.55, 0.82);
    this.bloom.enabled = q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    if (this.lights) {
      this.lights.sun.shadow.mapSize.set(q.shadow, q.shadow);
      this.lights.sun.shadow.map?.dispose();
      this.lights.sun.shadow.map = null;
    }
    if (this.theme) this.bloom.strength = this.theme.bloom;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  }

  initWorld() {
    this.scene = new THREE.Scene();
    this.car = new Car(this.save.paint);
    this.sparks = new Particles(1800, true);
    this.dust = new Particles(900, false);
    this.scene.add(this.sparks.points, this.dust.points);
    this.obstacles = new Obstacles(this.scene, this.sparks);
    this.rain = new Rain();
    this.world = {
      isSolid: (x, z) => (this.city ? this.city.isSolid(x, z) : true),
      holeKindAt: (x, z) => (this.city ? this.city.holeKindAt(x, z) : null),
    };
  }

  initShowroom() {
    const s = (this.showroom = new THREE.Scene());
    s.background = new THREE.Color(0x040405);
    s.fog = new THREE.Fog(0x040405, 12, 34);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    s.environmentIntensity = 0.3;
    pmrem.dispose();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.05, 96), new THREE.MeshPhysicalMaterial({ color: 0x111113, roughness: 0.3, metalness: 0.6, clearcoat: 1 }));
    table.position.y = 0.025;
    table.receiveShadow = true;
    s.add(table);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.82, 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(3) }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    s.add(ring);
    // light strips for reflections on the paint
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.2), side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4), stripMat);
      const a = -0.9 + i * 0.45;
      st.position.set(Math.sin(a) * 14, 2.2, -Math.cos(a) * 14);
      st.lookAt(0, 2.2, 0);
      s.add(st);
    }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), stripMat);
    top.position.y = 7.5;
    top.rotation.x = Math.PI / 2;
    s.add(top);
    const key = new THREE.SpotLight(0xffffff, 260, 30, 0.42, 0.6, 1.6);
    key.position.set(2, 9, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    s.add(key, key.target);
    const rim = new THREE.SpotLight(0xff3040, 70, 25, 0.5, 0.8, 1.6);
    rim.position.set(-6, 3, -6);
    s.add(rim, rim.target);
    const rim2 = new THREE.SpotLight(0x5ab0ff, 55, 25, 0.5, 0.8, 1.6);
    rim2.position.set(6, 2.5, -5);
    s.add(rim2, rim2.target);
    this.showroomCam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 200);
  }

  // ------------------------------------------------------------------ UI
  initUI() {
    const wake = () => {
      this.audio.init();
      this.audio.setVolumes(this.save.music, this.save.sfx);
      if (!this.audio.track) this.audio.playTrack(this.state === 'playing' ? this.trackFor() : 'menu');
    };
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);

    const click = (id, fn) => $(id).addEventListener('click', () => { this.audio.ui(); fn(); });
    click('btn-play', () => this.startLevel(Math.min(this.save.unlocked, LEVELS.length) - 1));
    click('btn-levels', () => { this.buildLevelGrid(); this.showScreen('levels'); });
    click('btn-settings', () => this.showScreen('settings'));
    click('btn-controls', () => this.showScreen('controls'));
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { this.audio.ui(); this.showScreen('menu'); }));
    click('btn-resume', () => this.resume());
    click('btn-restart', () => this.startLevel(this.levelIdx));
    click('btn-quit', () => this.toMenu());
    click('btn-retry', () => this.startLevel(this.levelIdx));
    click('btn-menu', () => this.toMenu());
    click('btn-next', () => this.startLevel(Math.min(this.levelIdx + 1, LEVELS.length - 1)));
    $('t-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); this.pause(); });

    // paints
    const paints = $('paints');
    for (const [key, p] of Object.entries(PAINTS)) {
      const b = document.createElement('button');
      b.style.background = `#${p.color.toString(16).padStart(6, '0')}`;
      b.title = p.name;
      b.dataset.key = key;
      b.addEventListener('click', () => {
        this.audio.ui();
        this.save.paint = key;
        this.persist();
        setPaint(this.car.model, key);
        this.refreshPaints();
      });
      paints.appendChild(b);
    }
    this.refreshPaints();

    // settings
    const q = $('set-quality'), m = $('set-music'), s = $('set-sfx'), c = $('set-camera');
    q.value = this.save.quality;
    m.value = this.save.music;
    s.value = this.save.sfx;
    c.value = String(this.camMode);
    q.addEventListener('change', () => { this.save.quality = q.value; this.persist(); this.applyQuality(); });
    m.addEventListener('input', () => { this.save.music = +m.value; this.audio.setVolumes(this.save.music, this.save.sfx); this.persist(); });
    s.addEventListener('input', () => { this.save.sfx = +s.value; this.audio.setVolumes(this.save.music, this.save.sfx); this.persist(); });
    c.addEventListener('change', () => { this.camMode = +c.value; this.save.camera = this.camMode; this.persist(); });
    click('btn-reset', () => {
      if (!confirm('¿Borrar todo el progreso?')) return;
      this.save.unlocked = 1;
      this.save.best = {};
      this.persist();
    });
  }

  refreshPaints() {
    document.querySelectorAll('#paints button').forEach((b) => b.classList.toggle('sel', b.dataset.key === this.save.paint));
    $('paint-name').textContent = PAINTS[this.save.paint]?.name || '';
  }

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage unavailable */ }
  }

  buildLevelGrid() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = i + 1 > this.save.unlocked;
      const best = this.save.best[lv.id];
      const el = document.createElement('button');
      el.className = 'level-card' + (locked ? ' locked' : '');
      const stars = best ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : '☆☆☆';
      el.innerHTML = `<div class="num">NIVEL ${lv.id}</div><div class="name">${lv.name}</div><div class="desc">${lv.desc}</div>
        <div class="meta"><span class="theme-tag">${THEMES[lv.theme].label}</span><span>${best ? fmtTime(best.time) + ' · ' + best.score + ' pts' : '—'}</span><span class="st">${stars}</span></div>`;
      if (!locked) el.addEventListener('click', () => { this.audio.ui(); this.startLevel(i); });
      grid.appendChild(el);
    });
  }

  showScreen(id) {
    document.querySelectorAll('.screen.show').forEach((e) => e.classList.remove('show'));
    if (id) $(id).classList.add('show');
    if (['menu', 'levels', 'settings', 'controls'].includes(id)) {
      this.state = 'menu';
      $('hud').classList.add('hidden');
      $('touch').classList.add('hidden');
      this.enterShowroom();
    }
  }

  enterShowroom() {
    if (this.car.group.parent !== this.showroom) {
      this.showroom.add(this.car.group);
      this.car.reset(0, 0);
      this.car.model.beam.intensity = 0;
    }
    this.renderPass.scene = this.showroom;
    this.renderPass.camera = this.showroomCam;
    this.renderer.toneMappingExposure = 1.0;
    this.bloom.strength = 0.25;
    this.bloom.threshold = 0.88;
    if (this.audio.ctx) this.audio.playTrack('menu');
    this.audio.updateCar({ speed: 0, throttle: false, boost: 0, lift: 0, grounded: true, scrape: false, active: false });
  }

  toMenu() {
    this.unloadLevel();
    this.showScreen('menu');
  }

  trackFor() {
    if (!this.level) return 'menu';
    if (this.level.id === LEVELS.length) return 'finale';
    return this.level.theme;
  }

  // ------------------------------------------------------------------ levels
  unloadLevel() {
    if (this.city) {
      this.scene.remove(this.city.root);
      this.city.dispose();
      this.city = null;
    }
    this.obstacles.clear();
    this.sparks.clear();
    this.dust.clear();
  }

  startLevel(idx) {
    this.showScreen(null);
    $('loading-text').textContent = `Generando · ${LEVELS[idx].name}`;
    $('loading').classList.add('show');
    this.state = 'loading';
    setTimeout(() => {
      this.loadLevel(idx);
      $('loading').classList.remove('show');
    }, 40);
  }

  loadLevel(idx) {
    this.unloadLevel();
    this.levelIdx = idx;
    const level = (this.level = LEVELS[idx]);
    const theme = (this.theme = THEMES[level.theme]);
    const sc = this.scene;
    sc.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    if (this.sky) { sc.remove(this.sky); this.sky.geometry.dispose(); this.sky.material.dispose(); }
    this.sky = createSky(theme);
    sc.add(this.sky);
    if (this.envRT) this.envRT.dispose();
    this.envRT = createEnvironmentMap(this.renderer, theme);
    sc.environment = this.envRT.texture;
    sc.environmentIntensity = theme.stars > 0.5 ? 0.7 : 1;
    if (this.lights) sc.remove(this.lights.group);
    this.lights = createLights(theme);
    this.lights.sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    sc.add(this.lights.group);
    this.renderer.toneMappingExposure = theme.exposure;
    this.bloom.strength = theme.bloom;
    this.bloom.threshold = 0.9;

    this.layout = layoutLevel(level);
    this.city = buildCity(this.layout, theme, level.id * 101 + 7);
    sc.add(this.city.root);
    this.obstacles.build(this.layout, theme, level.id);
    this.totalCells = this.obstacles.totalCells;
    if (level.id === LEVELS.length) sc.add(this.rain.lines);
    else sc.remove(this.rain.lines);

    sc.add(this.car.group, this.car.model.blob);
    this.car.reset(2, 9);
    this.car.model.beam.intensity = theme.headlights ? (theme.stars > 0.5 ? 220 : 90) : 0;
    this.renderPass.scene = sc;
    this.renderPass.camera = this.camera;

    this.elapsed = 0;
    this.cellsTaken = 0;
    this.bonusCount = 0;
    this.crashes = 0;
    this.nextCp = 1;
    this.lastCp = 0;
    this.hintIdx = 0;
    this.invuln = 0;
    this.countdown = 3.6;
    this.lastCount = 4;
    this.introAngle = 0;
    this.state = 'intro';
    this.finishTimer = 0;

    $('hud').classList.remove('hidden');
    $('touch').classList.toggle('hidden', !isTouch);
    $('hud-lvl-num').textContent = `NIVEL ${level.id}`;
    $('hud-lvl-name').textContent = level.name;
    $('hud-limit').textContent = `LÍMITE ${fmtTime(this.layout.timeLimit)}`;
    const marks = $('hud-marks');
    marks.innerHTML = '';
    for (const cp of this.layout.checkpoints.slice(1)) {
      const sp = document.createElement('span');
      sp.style.left = `${(cp / this.layout.length) * 100}%`;
      marks.appendChild(sp);
    }
    this.msg('', '');
    this.hint(null);
    if (this.audio.ctx) this.audio.playTrack(this.trackFor());
    this.audio.duck(false);
    this.placeCamera(true);
  }

  // ------------------------------------------------------------------ HUD helpers
  msg(text, sub, danger = false) {
    const el = $('hud-msg');
    if (!text) { el.classList.remove('show'); return; }
    el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.classList.toggle('danger', danger);
    el.classList.add('show');
  }

  hint(html) {
    const el = $('hud-hint');
    clearTimeout(this.hintTimer);
    if (!html) { el.classList.remove('show'); return; }
    el.innerHTML = html;
    el.classList.add('show');
    this.hintTimer = setTimeout(() => el.classList.remove('show'), 4800);
  }

  popup(text) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    $('hud-popups').appendChild(el);
    setTimeout(() => el.remove(), 1250);
  }

  flashCp() {
    const el = $('hud-cp');
    el.classList.add('show');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('show')));
  }

  get score() {
    return this.cellsTaken * 100 + this.bonusCount * 150 - this.crashes * 250;
  }

  updateHUD() {
    const c = this.car;
    $('hud-speed').textContent = Math.round(Math.abs(c.speed) * 3.6);
    $('hud-gear').textContent = this.state === 'intro' ? 'P' : c.speed < -0.3 ? 'R' : 'D';
    const fuel = $('hud-fuel');
    fuel.style.width = `${(c.fuel * 100).toFixed(1)}%`;
    fuel.classList.toggle('low', c.fuel < 0.15);
    $('hud-alt').textContent = `ALT ${Math.max(0, c.pos.y).toFixed(1)} m`;
    const time = $('hud-time');
    time.textContent = fmtTime(this.elapsed);
    time.classList.toggle('warn', this.layout.timeLimit - this.elapsed < 15);
    $('hud-progress').style.width = `${THREE.MathUtils.clamp(-c.pos.z / this.layout.length, 0, 1) * 100}%`;
    $('hud-cells').textContent = `${this.cellsTaken}/${this.totalCells}`;
    $('hud-score').textContent = `${Math.max(0, this.score)} PTS`;
  }

  // ------------------------------------------------------------------ flow
  pause() {
    if (this.state !== 'playing' && this.state !== 'crashed' && this.state !== 'intro') return;
    this.prevState = this.state;
    this.state = 'paused';
    $('pause').classList.add('show');
    this.audio.duck(true);
    this.audio.updateCar({ speed: 0, throttle: false, boost: 0, lift: 0, grounded: true, scrape: false, active: false });
  }

  resume() {
    if (this.state !== 'paused') return;
    $('pause').classList.remove('show');
    this.state = this.prevState;
    this.audio.duck(false);
    this.last = performance.now();
  }

  crash(kind) {
    if (this.state !== 'playing') return;
    this.state = 'crashed';
    this.crashKind = kind;
    this.crashTimer = kind === 'creek' || kind === 'pit' ? 2.1 : 1.8;
    this.splashed = false;
    if (kind !== 'reset') {
      this.crashes++;
      this.elapsed += 5;
    } else this.elapsed += 3;
    const [t, s] = CRASH_TEXT[kind] || CRASH_TEXT.vehicle;
    this.msg(t, kind === 'reset' ? s : `${s} · +5 s`, kind !== 'reset');
    const c = this.car;
    if (kind === 'creek') this.audio.fallPit();
    else if (kind === 'pit') this.audio.fallPit();
    else if (kind !== 'reset') {
      this.audio.crash(kind);
      const front = new THREE.Vector3(c.pos.x + c.forwardX * 2, c.pos.y + 0.6, c.pos.z + c.forwardZ * 2);
      this.sparks.emit(front, 90, { color: 0xffa040, speed: 12, spread: 1.2, up: 2, life: 0.9, size: 0.18, gravity: 14 });
      this.dust.emit(front, 30, { color: 0x6a6a6a, speed: 3, spread: 1, up: 1.5, life: 1.6, size: 1.6, gravity: -0.5, drag: 1 });
      c.speed *= -0.12;
      this.shake = 0.7;
    }
    this.audio.duck(true);
  }

  respawn() {
    const cp = this.lastCp;
    this.car.reset(2, -(cp + 6));
    this.car.speed = 30;
    this.invuln = 2.6;
    this.state = 'playing';
    this.msg('', '');
    this.audio.duck(false);
    this.placeCamera(true);
  }

  complete() {
    this.state = 'complete';
    this.finishTimer = 0;
    this.audio.complete();
    const L = this.layout;
    const timeBonus = Math.max(0, Math.round((L.timeLimit - this.elapsed) * 20));
    const total = Math.max(0, this.score + timeBonus);
    let stars = 1;
    if (this.elapsed <= L.par * 1.35 && this.crashes <= 2) stars = 2;
    if (this.elapsed <= L.par && this.crashes === 0 && this.cellsTaken >= this.totalCells * 0.6) stars = 3;
    const id = this.level.id;
    const prev = this.save.best[id];
    const isBest = !prev || total > prev.score;
    if (isBest) this.save.best[id] = { time: +this.elapsed.toFixed(2), score: total, stars: Math.max(stars, prev?.stars || 0) };
    else if (stars > prev.stars) prev.stars = stars;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, id + 1));
    this.persist();
    for (let k = 0; k < 6; k++) {
      setTimeout(() => {
        const p = new THREE.Vector3((Math.random() - 0.5) * 14, 8 + Math.random() * 6, this.car.pos.z - 30 - Math.random() * 20);
        this.sparks.emit(p, 120, { color: [0xff2a3a, 0xffffff, 0x40e0ff][k % 3], speed: 10, spread: 1, up: 1, life: 1.6, size: 0.35, gravity: 4, drag: 1.2 });
        this.audio.noiseHit({ type: 'white', filter: 'bandpass', freq: 1800, peak: 0.25, d: 0.5, reverb: true });
      }, 200 + k * 260);
    }
    this.msg('META', fmtTime(this.elapsed));
    setTimeout(() => this.showResults(true, { timeBonus, total, stars, isBest }), 1900);
  }

  fail() {
    this.state = 'failed';
    this.audio.fail();
    this.msg('TIEMPO AGOTADO', '', true);
    setTimeout(() => this.showResults(false, {}), 1600);
  }

  showResults(ok, r) {
    if (this.state !== 'complete' && this.state !== 'failed') return;
    this.msg('', '');
    $('res-title').textContent = ok ? (r.isBest ? 'Nuevo récord' : 'Nivel completado') : 'Tiempo agotado';
    $('res-stars').innerHTML = ok ? [0, 1, 2].map((i) => `<span class="${i < r.stars ? '' : 'off'}">★</span>`).join('') : '';
    const rows = ok
      ? [['Tiempo', fmtTime(this.elapsed)], ['Par', fmtTime(this.layout.par)], ['Celdas de energía', `${this.cellsTaken}/${this.totalCells}`], ['Saltos limpios', this.bonusCount], ['Choques', this.crashes], ['Bono de tiempo', `+${r.timeBonus}`]]
      : [['Distancia', `${Math.round(Math.max(0, -this.car.pos.z))} / ${Math.round(this.layout.length)} m`], ['Celdas de energía', `${this.cellsTaken}/${this.totalCells}`], ['Choques', this.crashes]];
    $('res-grid').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('') + (ok ? `<span class="total">Puntuación</span><span class="total">${r.total}</span>` : '');
    $('btn-next').classList.toggle('hidden', !ok || this.levelIdx >= LEVELS.length - 1);
    $('results').classList.add('show');
  }

  // ------------------------------------------------------------------ camera
  placeCamera(snap) {
    this.updateCamera(1, snap);
  }

  updateCamera(dt, snap = false) {
    const c = this.car, cam = this.camera;
    const fx = c.forwardX, fz = c.forwardZ;
    const sp = Math.abs(c.speed);
    const modes = [
      { back: 7.6, up: 2.6, look: 7, lookUp: 0.3 },
      { back: 5.4, up: 1.8, look: 7, lookUp: 0.4 },
      { back: 12.5, up: 4.2, look: 12, lookUp: 0.5 },
      { back: -0.25, up: 1.12, look: 20, lookUp: 0.9 },
    ];
    const m = modes[this.camMode] || modes[0];
    const desired = new THREE.Vector3(c.pos.x - fx * m.back, Math.max(0.9, c.pos.y) + m.up, c.pos.z - fz * m.back);
    if (this.state === 'intro') {
      // cinematic sweep from the front to the chase position during the countdown
      const k = THREE.MathUtils.smoothstep(1 - this.countdown / 3.6, 0, 1);
      const ang = Math.PI * 0.85 * (1 - k);
      const rad = 7 + (1 - k) * 2;
      desired.set(c.pos.x + Math.sin(ang) * rad, 1.4 + k * (m.up - 0.4), c.pos.z + Math.cos(ang) * rad);
    }
    if (this.state === 'crashed' && (this.crashKind === 'creek' || this.crashKind === 'pit')) desired.y = Math.max(desired.y, 3.5);
    if (this.state === 'complete') {
      const a = this.finishTimer * 0.4;
      desired.set(c.pos.x + Math.sin(a) * 9, 2.6, c.pos.z + Math.cos(a) * 9);
    }
    const hood = this.camMode === 3 && this.state === 'playing';
    const k = snap ? 1 : 1 - Math.exp(-dt * (hood ? 30 : 7));
    cam.position.lerp(desired, k);
    cam.position.y = Math.max(cam.position.y, 0.5);
    const look = new THREE.Vector3(c.pos.x + fx * m.look, Math.max(0, c.pos.y) * 0.85 + m.lookUp, c.pos.z + fz * m.look);
    if (this.state === 'intro' || this.state === 'complete') look.set(c.pos.x, 0.7, c.pos.z);
    if (this.state === 'crashed') look.set(c.pos.x, Math.max(c.pos.y, -2) + 0.6, c.pos.z);
    if (!this.lookAt || snap) this.lookAt = look.clone();
    this.lookAt.lerp(look, snap ? 1 : 1 - Math.exp(-dt * 10));
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    cam.lookAt(this.lookAt);
    const fovT = 60 + Math.min(1, sp / 75) * 16 + (c.boosting ? 6 : 0);
    cam.fov += (fovT - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ main loop
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.handleKeys();

    switch (this.state) {
      case 'menu': this.updateShowroom(dt); break;
      case 'intro': this.updateIntro(dt); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'crashed': this.updateCrashed(dt); break;
      case 'complete':
      case 'failed': this.updateEnd(dt); break;
      default: break;
    }
    if (this.state !== 'menu' && this.state !== 'loading' && this.city && this.state !== 'paused') this.updateWorldFx(dt);
    this.composer.render(dt);
  }

  handleKeys() {
    const i = this.input;
    if (i.consume('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      if (this.state !== 'menu') this.popup(this.audio.muted ? 'SONIDO OFF' : 'SONIDO ON');
    }
    if (i.consume('Escape') || i.consume('KeyP')) {
      if (this.state === 'paused') this.resume();
      else this.pause();
    }
    if (i.consume('KeyC') && this.state !== 'menu') {
      this.camMode = (this.camMode + 1) % 4;
      this.save.camera = this.camMode;
      this.persist();
    }
    if (i.consume('KeyR') && this.state === 'playing') this.crash('reset');
    if (i.consume('Enter')) {
      if ($('results').classList.contains('show')) $('btn-next').classList.contains('hidden') ? $('btn-retry').click() : $('btn-next').click();
      else if (this.state === 'menu' && $('menu').classList.contains('show')) $('btn-play').click();
    }
    i.clearPressed();
  }

  updateShowroom(dt) {
    const c = this.car;
    c.group.rotation.y += dt * 0.25;
    c.wheelSpin = 0;
    c.syncGroup(dt);
    c.group.rotation.y = (this.t * 0.25) % (Math.PI * 2);
    c.group.position.set(0, 0.05, 0);
    const a = Math.PI * 0.8 + this.t * 0.08;
    const cam = this.showroomCam;
    cam.aspect = innerWidth / innerHeight;
    const r = innerWidth < innerHeight ? 13 : 8.6;
    cam.position.set(Math.sin(a) * r, 1.55 + Math.sin(this.t * 0.2) * 0.2, Math.cos(a) * r);
    cam.lookAt(0, 0.45, 0);
    cam.updateProjectionMatrix();
  }

  updateIntro(dt) {
    this.countdown -= dt;
    const n = Math.ceil(this.countdown - 0.6);
    if (n !== this.lastCount && n >= 1 && n <= 3) {
      this.lastCount = n;
      this.msg(String(n), '');
      this.audio.countdown(false);
    }
    // allow revving during countdown
    const inp = this.input.read();
    this.audio.updateCar({ speed: inp.throttle ? 25 + Math.sin(this.t * 30) * 2 : 0, throttle: inp.throttle, boost: 0, lift: 0, grounded: true, scrape: false, active: true });
    this.car.syncGroup(dt);
    if (this.countdown <= 0.6) {
      this.state = 'playing';
      this.msg('GO', '');
      this.audio.countdown(true);
      setTimeout(() => { if (this.state === 'playing') this.msg('', ''); }, 700);
      const h = this.level.hints[0];
      if (h && h.d <= 5) { this.hint(h.text); this.hintIdx = 1; }
    }
    this.updateCamera(dt);
    this.updateHUD();
  }

  updatePlaying(dt) {
    const c = this.car;
    const inp = this.input.read();
    const steps = dt > 1 / 55 ? 2 : 1;
    const h = dt / steps;
    let scrape = false;
    for (let s = 0; s < steps; s++) {
      const ev = c.update(h, { ...inp, jumpPressed: inp.jumpPressed && s === 0 }, this.world);
      if (ev.jumped) {
        this.audio.jump();
        this.dust.emit(new THREE.Vector3(c.pos.x, 0.2, c.pos.z), 26, { color: 0x8a8580, speed: 5, spread: 1.4, up: 0.6, life: 1.2, size: 1.3, gravity: -0.3, drag: 2 });
      }
      if (ev.landed > 5) {
        this.audio.land(ev.landed);
        this.dust.emit(new THREE.Vector3(c.pos.x, 0.15, c.pos.z), Math.min(40, ev.landed * 2), { color: 0x8a8580, speed: 6, spread: 1.6, up: 0.4, life: 1, size: 1.2, gravity: -0.2, drag: 2.2 });
        this.shake = Math.max(this.shake, Math.min(0.35, ev.landed * 0.015));
      }
      if (ev.scrape) scrape = true;
      if (ev.fell) { this.crash(ev.fell); break; }
    }
    if (this.state !== 'playing') return this.updateCamera(dt);

    if (scrape) {
      const side = Math.sign(c.pos.x);
      this.sparks.emit(new THREE.Vector3(c.pos.x + side * 0.95, 0.3, c.pos.z), 3, { color: 0xffb050, speed: 6, spread: 0.6, up: 1, life: 0.4, size: 0.12, gravity: 12, dir: new THREE.Vector3(0, 0, -c.forwardZ * 2) });
    }
    // thruster exhaust particles
    if (c.liftLevel > 0.3) {
      for (const [x, z] of [[-0.72, -1.4], [0.72, 1.55]]) {
        const p = new THREE.Vector3(x, 0.1, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw).add(c.pos);
        this.sparks.emit(p, 2, { color: 0x5ab4ff, speed: 3, spread: 0.3, up: 0, life: 0.35, size: 0.4, gravity: 18, dir: new THREE.Vector3(0, -2, 0) });
      }
      if (c.pos.y < 3) this.dust.emit(new THREE.Vector3(c.pos.x, 0.1, c.pos.z), 1, { color: 0x9a9590, speed: 6, spread: 1.5, up: 0.2, life: 0.9, size: 1.4, gravity: -0.3, drag: 2 });
    }
    if (c.boosting) {
      const p = new THREE.Vector3(0, 0.48, 2.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw).add(c.pos);
      this.sparks.emit(p, 3, { color: 0x6ac0ff, speed: 2, spread: 0.2, up: 0, life: 0.25, size: 0.45, gravity: 0, dir: new THREE.Vector3(-c.forwardX * 8, 0, -c.forwardZ * 8) });
    }

    this.invuln = Math.max(0, this.invuln - dt);
    c.group.visible = this.invuln <= 0 || Math.floor(this.t * 12) % 2 === 0;
    const oe = this.obstacles.update(dt, c, this.t, this.invuln > 0);
    if (oe.cells) {
      this.cellsTaken += oe.cells;
      c.fuel = Math.min(1, c.fuel + 0.25 * oe.cells);
      this.audio.collect();
      this.popup('+100 ENERGÍA');
    }
    if (oe.bonus) {
      this.bonusCount += oe.bonus;
      this.audio.bonus();
      this.popup(`SALTO LIMPIO +${150 * oe.bonus}`);
    }
    if (oe.honk) { this.audio.honk(); this.audio.whoosh(); }
    if (oe.cone) this.audio.cone();
    if (oe.crash) {
      c.group.visible = true;
      return this.crash(oe.crash.kind);
    }

    const d = -c.pos.z;
    const cps = this.layout.checkpoints;
    if (this.nextCp < cps.length && d >= cps[this.nextCp]) {
      this.lastCp = cps[this.nextCp];
      this.nextCp++;
      this.audio.checkpoint();
      this.flashCp();
      this.popup('CHECKPOINT');
    }
    const hints = this.level.hints;
    if (this.hintIdx < hints.length && d >= hints[this.hintIdx].d) this.hint(hints[this.hintIdx++].text);
    this.elapsed += dt;
    if (d >= this.layout.length) { c.group.visible = true; this.complete(); }
    else if (this.elapsed > this.layout.timeLimit) this.fail();

    this.audio.updateCar({ speed: c.speed, throttle: inp.throttle, boost: c.thrustLevel, lift: c.liftLevel, grounded: c.grounded, scrape, active: true });
    this.updateCamera(dt);
    this.updateHUD();
  }

  updateCrashed(dt) {
    const c = this.car;
    this.crashTimer -= dt;
    if (this.crashKind === 'creek' || this.crashKind === 'pit') {
      if (c.pos.y > -3.3 || this.crashKind === 'pit') {
        c.update(dt, { steer: 0, throttle: false, brake: false, jump: false, jumpPressed: false, boost: false }, this.world);
        if (c.pos.y < -4.2) { c.pos.y = -4.2; c.speed = 0; c.vy = 0; c.syncGroup(dt); }
      }
      if (this.crashKind === 'creek' && c.pos.y <= -3.2 && !this.splashed) {
        this.splashed = true;
        this.audio.splash();
        const p = new THREE.Vector3(c.pos.x, -3.3, c.pos.z);
        this.dust.emit(p, 60, { color: 0xd8e8f0, speed: 9, spread: 1, up: 3, life: 1.4, size: 1, gravity: 14, drag: 0.6 });
        this.sparks.emit(p, 60, { color: 0x9fd4ff, speed: 7, spread: 1, up: 3, life: 1.2, size: 0.25, gravity: 16, drag: 0.6 });
        this.shake = 0.5;
      }
    } else if (this.crashKind !== 'reset') {
      c.speed *= Math.max(0, 1 - dt * 3);
      c.update(dt, { steer: 0, throttle: false, brake: false, jump: false, jumpPressed: false, boost: false }, this.world);
    }
    this.obstacles.update(dt, c, this.t, true);
    this.audio.updateCar({ speed: c.speed, throttle: false, boost: 0, lift: 0, grounded: c.grounded, scrape: false, active: true });
    this.updateCamera(dt);
    this.updateHUD();
    if (this.crashTimer <= 0) this.respawn();
  }

  updateEnd(dt) {
    const c = this.car;
    this.finishTimer += dt;
    if (c.speed > 0) c.speed = Math.max(0, c.speed - dt * 18);
    c.update(dt, { steer: 0, throttle: false, brake: c.speed > 1, jump: false, jumpPressed: false, boost: false }, this.world);
    this.obstacles.update(dt, c, this.t, true);
    this.audio.updateCar({ speed: c.speed, throttle: false, boost: 0, lift: 0, grounded: c.grounded, scrape: false, active: true });
    this.updateCamera(dt);
  }

  updateWorldFx(dt) {
    const c = this.car;
    const d = -c.pos.z;
    this.city.update(this.t, d);
    const sun = this.lights.sun;
    sun.target.position.set(c.pos.x, 0, c.pos.z - 15);
    sun.position.copy(sun.target.position).addScaledVector(this.lights.dir, 140);
    this.sky.position.copy(this.camera.position);
    this.sparks.update(dt);
    this.dust.update(dt);
    if (this.rain.lines.parent) this.rain.update(dt, this.camera.position, Math.max(0, c.speed));
  }
}

window.game = new Game();
