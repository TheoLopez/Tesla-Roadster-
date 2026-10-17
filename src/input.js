// Keyboard + touch + gamepad, merged into one input state per frame.
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, jump: false, boost: false };
    this.prevJump = false;
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.bindTouch();
  }

  bindTouch() {
    const map = { 't-left': 'left', 't-right': 'right', 't-gas': 'gas', 't-brake': 'brake', 't-jump': 'jump', 't-boost': 'boost' };
    for (const [id, key] of Object.entries(map)) {
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
    let steer = 0;
    if (k.has('KeyA') || k.has('ArrowLeft') || t.left) steer += 1;
    if (k.has('KeyD') || k.has('ArrowRight') || t.right) steer -= 1;
    let throttle = k.has('KeyW') || k.has('ArrowUp') || t.gas;
    let brake = k.has('KeyS') || k.has('ArrowDown') || t.brake;
    let jump = k.has('Space') || t.jump;
    let boost = k.has('ShiftLeft') || k.has('ShiftRight') || t.boost;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.15) steer = -ax;
      if ((p.buttons[7] && p.buttons[7].value > 0.2) || (p.buttons[12] && p.buttons[12].pressed)) throttle = true;
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
