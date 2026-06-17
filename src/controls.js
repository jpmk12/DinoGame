// Input layer: keyboard (desktop) + virtual joystick + chomp button (touch).

export class Controls {
  constructor() {
    this.move = { x: 0, y: 0 }; // -1..1
    this.chompPressed = false;  // edge: true for one frame after press
    this._chompFlag = false;
    this.blastPressed = false;  // edge: true for one frame after press
    this._blastFlag = false;

    // Keyboard state
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        this._chompFlag = true;
        e.preventDefault();
      }
      if (e.code === 'KeyB' || e.code === 'KeyF') {
        this._blastFlag = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this._setupJoystick();
    this._setupChompBtn();
    this._setupBlastBtn();
  }

  _setupJoystick() {
    // Floating joystick: an invisible zone covers the left half of the
    // screen (excluding the top HUD area). When the user taps anywhere
    // in that zone, the joystick spawns at the touch point and follows
    // their finger from there. On release it disappears.
    const zone = document.getElementById('joystick-zone');
    const j = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (!zone || !j || !knob) return;
    let activeId = null;
    let anchorX = 0, anchorY = 0;
    const radius = 55;
    this._touchMove = { x: 0, y: 0 };

    const reset = () => {
      knob.style.transform = 'translate(-50%, -50%)';
      j.classList.add('hidden');
      this._touchMove = { x: 0, y: 0 };
    };

    const place = (cx, cy) => {
      anchorX = cx;
      anchorY = cy;
      j.style.left = (cx - radius - 10) + 'px';
      j.style.top  = (cy - radius - 10) + 'px';
      j.classList.remove('hidden');
    };

    const update = (cx, cy) => {
      let dx = cx - anchorX;
      let dy = cy - anchorY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      knob.style.transform =
        `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this._touchMove = { x: dx / radius, y: dy / radius };
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (activeId !== null) return;
      const t = e.changedTouches[0];
      activeId = t.identifier;
      place(t.clientX, t.clientY);
      update(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === activeId) {
          update(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === activeId) {
          activeId = null;
          reset();
          break;
        }
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  _setupChompBtn() {
    const btn = document.getElementById('chomp-btn');
    if (!btn) return;
    const fire = (e) => {
      e.preventDefault();
      this._chompFlag = true;
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  }

  _setupBlastBtn() {
    const btn = document.getElementById('blast-btn');
    if (!btn) return;
    const fire = (e) => {
      e.preventDefault();
      this._blastFlag = true;
    };
    btn.addEventListener('touchstart', fire, { passive: false });
    btn.addEventListener('mousedown', fire);
  }

  // Call once per frame to read state.
  update() {
    let mx = 0, my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (mx || my) {
      const d = Math.hypot(mx, my) || 1;
      mx /= d; my /= d;
    }
    // Combine with touch (touch overrides if larger)
    if (this._touchMove) {
      const tm = Math.hypot(this._touchMove.x, this._touchMove.y);
      if (tm > Math.hypot(mx, my)) {
        mx = this._touchMove.x;
        my = this._touchMove.y;
      }
    }
    this.move.x = mx;
    this.move.y = my;
    this.chompPressed = this._chompFlag;
    this._chompFlag = false;
    this.blastPressed = this._blastFlag;
    this._blastFlag = false;
  }
}
