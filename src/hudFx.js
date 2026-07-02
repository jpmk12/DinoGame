import * as THREE from 'three';

// HUD juice: floating "+N" score popups, combo counter, screen flash.
// Everything renders as CSS/DOM so we don't pay a WebGL cost for the
// numbers that fly off every kill.

let _camera = null;
let _fxContainer = null;
let _comboHud = null;
let _comboCount = 0;
let _comboDecay = 0;
const COMBO_WINDOW = 3.0;   // seconds after last kill before combo resets
const COMBO_MULT_STEP = 0.1;
const COMBO_MULT_MAX = 3.0;

const _tmpVec = new THREE.Vector3();

export function initHudFx(camera) {
  _camera = camera;
  _fxContainer = document.getElementById('fx-container');
  _comboHud = document.getElementById('combo-hud');
}

/**
 * Project a world position to screen pixels and spawn a floating
 * "+N" element that arcs up + fades. `color` is any CSS color.
 * `variant` biases the font size — 'big' for major kills.
 */
export function spawnScorePopup(worldPos, text, color = '#ffd24a', variant = 'normal') {
  if (!_camera || !_fxContainer) return;
  _tmpVec.copy(worldPos);
  _tmpVec.y += 2.0; // start slightly above the target's center
  _tmpVec.project(_camera);
  if (_tmpVec.z > 1 || _tmpVec.z < -1) return; // behind camera
  const x = (_tmpVec.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_tmpVec.y * 0.5 + 0.5) * window.innerHeight;
  if (x < -80 || x > window.innerWidth + 80) return;
  if (y < -80 || y > window.innerHeight + 80) return;
  const el = document.createElement('div');
  el.className = 'score-popup' + (variant === 'big' ? ' big' : '');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = color;
  // Slight horizontal jitter so back-to-back kills don't stack perfectly
  el.style.setProperty('--drift-x', ((Math.random() - 0.5) * 60) + 'px');
  _fxContainer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/**
 * A kill just happened — extend the combo window and bump the count.
 * Returns the current multiplier the caller should apply to score/growth.
 */
export function bumpCombo() {
  _comboCount++;
  _comboDecay = COMBO_WINDOW;
  updateComboHUD();
  return getComboMult();
}

export function getComboMult() {
  return Math.min(COMBO_MULT_MAX, 1 + Math.max(0, _comboCount - 1) * COMBO_MULT_STEP);
}

export function tickCombo(dt) {
  if (_comboDecay > 0) {
    _comboDecay -= dt;
    if (_comboDecay <= 0) {
      _comboCount = 0;
      updateComboHUD();
    } else {
      updateComboTimer();
    }
  }
}

export function resetCombo() {
  _comboCount = 0;
  _comboDecay = 0;
  updateComboHUD();
}

function updateComboHUD() {
  if (!_comboHud) return;
  if (_comboCount < 2) {
    _comboHud.classList.add('hidden');
    return;
  }
  _comboHud.classList.remove('hidden');
  document.getElementById('combo-count').textContent = _comboCount;
  document.getElementById('combo-mult').textContent = getComboMult().toFixed(1) + 'x';
  // Replay bump animation
  _comboHud.classList.remove('bump');
  // Force reflow so the animation restarts
  // eslint-disable-next-line no-unused-expressions
  _comboHud.offsetWidth;
  _comboHud.classList.add('bump');
  updateComboTimer();
}

function updateComboTimer() {
  const bar = document.getElementById('combo-fill');
  if (!bar) return;
  const pct = Math.max(0, Math.min(1, _comboDecay / COMBO_WINDOW));
  bar.style.width = (pct * 100) + '%';
}

/**
 * Fullscreen colored flash. Use for hit hits, Mega Beam ignition, boss
 * appear, etc. `intensity` is peak opacity (0..1). Decays over ~0.35s.
 */
export function flashScreen(color = '#ffffff', intensity = 0.5) {
  const el = document.getElementById('screen-flash');
  if (!el) return;
  el.style.background = color;
  el.style.setProperty('--flash-peak', intensity);
  el.classList.remove('flash');
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add('flash');
}

/**
 * Toggle a chromatic-aberration + high-contrast filter on the WebGL
 * canvas for the given duration. Cheap CSS filter, no post-processing
 * shader needed.
 */
let _abrTimer = 0;
export function pingChromaticAberration(duration = 0.5) {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  canvas.classList.add('chromatic');
  _abrTimer = duration;
}
export function tickChromaticAberration(dt) {
  if (_abrTimer > 0) {
    _abrTimer -= dt;
    if (_abrTimer <= 0) {
      const canvas = document.getElementById('game');
      if (canvas) canvas.classList.remove('chromatic');
    }
  }
}
