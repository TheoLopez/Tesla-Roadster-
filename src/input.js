// Keyboard + touch (yoke joystick and one pedal) + gamepad, merged into one input state per frame.
const YOKE_LOCK = (2 * Math.PI) / 3; // yoke rotation for full steering lock

// Keep receiving moves after the finger leaves the control; harmless if capture isn't available.
const capture = (el, id) => {
  try { el.setPointerCapture(id); } catch { /* not supported for this pointer */ }
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { steer: 0, pedal: 0, jump: false, boost: false };
    this.prevJump = false;
    this.prevStart = false;
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.bindButtons();
    this.bindYoke();
    this.bindPedal();
  }

  bindButtons() {
    for (const [id, key] of [['t-jump', 'jump'], ['t-boost', 'boost']]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const on = (e) => { e.preventDefault(); this.touch[key] = true; el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.touch[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    }
  }

  // Rotate the yoke like the real one: the angle of the finger around the yoke centre steers.
  // Dragging sideways also works, since that rotates the finger around the centre too.
  bindYoke() {
    const el = document.getElementById('t-yoke');
    if (!el) return;
    let id = null, startAngle = 0, base = 0, startX = 0;
    const angleOf = (e) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
    };
    const render = () => { el.style.transform = `rotate(${(-this.touch.steer * YOKE_LOCK * 180) / Math.PI}deg)`; };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      capture(el, id);
      startAngle = angleOf(e);
      startX = e.clientX;
      base = -this.touch.steer * YOKE_LOCK;
      el.style.transition = 'none';
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let d = angleOf(e) - startAngle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const drag = ((e.clientX - startX) / 90) * (YOKE_LOCK / 2);
      const rot = base + (Math.abs(drag) > Math.abs(d) ? drag : d);
      this.touch.steer = Math.max(-1, Math.min(1, -rot / YOKE_LOCK));
      render();
    });
    const release = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.touch.steer = 0;
      el.style.transition = 'transform 0.25s cubic-bezier(.2,.8,.3,1.2)';
      render();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  // Single accelerator pedal: press deeper (lower) for more power, lift to regenerate and slow down.
  bindPedal() {
    const el = document.getElementById('t-pedal');
    if (!el) return;
    const face = el.querySelector('.t-pedal-face');
    let id = null;
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const depth = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      this.touch.pedal = 0.25 + 0.75 * depth;
      face.style.transform = `scaleY(${1 - this.touch.pedal * 0.12})`;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      id = e.pointerId;
      capture(el, id);
      el.classList.add('on');
      set(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const release = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.touch.pedal = 0;
      face.style.transform = '';
      el.classList.remove('on');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  // Edge-triggered key presses for UI shortcuts (consumed once).
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  clearPressed() { this.pressed.clear(); }

  read() {
    const k = this.keys;
    const t = this.touch;
    let steer = t.steer;
    if (k.has('KeyA') || k.has('ArrowLeft')) steer += 1;
    if (k.has('KeyD') || k.has('ArrowRight')) steer -= 1;
    let throttle = Math.max(t.pedal, k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    let brake = k.has('KeyS') || k.has('ArrowDown');
    let jump = k.has('Space') || t.jump;
    let boost = k.has('ShiftLeft') || k.has('ShiftRight') || t.boost;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer = -ax;
      if (p.buttons[7]) throttle = Math.max(throttle, p.buttons[7].value);
      if (p.buttons[12] && p.buttons[12].pressed) throttle = 1;
      if ((p.buttons[6] && p.buttons[6].value > 0.2) || (p.buttons[13] && p.buttons[13].pressed)) brake = true;
      if (p.buttons[0] && p.buttons[0].pressed) jump = true;
      if ((p.buttons[2] && p.buttons[2].pressed) || (p.buttons[5] && p.buttons[5].pressed)) boost = true;
      const start = !!(p.buttons[9] && p.buttons[9].pressed);
      if (start && !this.prevStart) this.pressed.add('Escape');
      this.prevStart = start;
    }
    const jumpPressed = jump && !this.prevJump;
    this.prevJump = jump;
    return { steer: Math.max(-1, Math.min(1, steer)), throttle, brake, jump, jumpPressed, boost };
  }
}
