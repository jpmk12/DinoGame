import * as THREE from 'three';
import { Controls } from './controls.js';
import { buildWorld, WORLD_SIZE, spawnPlantRandom } from './world.js';
import {
  buildPlayer,
  populate,
  spawnEnemy,
  spawnCritter,
  STAGE_NAMES,
  STAGE_SCALE,
  STAGE_THRESHOLD,
  MAX_GROWTH,
} from './entities.js';
import { SPECIES, PLAYABLE_SPECIES } from './dinos.js';
import { preloadAllModels, modelStatus } from './modelLoader.js';

// ---------------- Scene / renderer setup ----------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 110);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
camera.position.set(0, 8, 12);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff4d6, 0.9);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

// Sun follow target so shadows track player
const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;

// ---------------- Resize ----------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------- World ----------------
const { plants } = buildWorld(scene);

// ---------------- Game state ----------------
const controls = new Controls();
let player = null;
let entities = null; // Group of enemies + critters
let score = 0;
let gameRunning = false;

// HUD elements
const hudEl = document.getElementById('hud');
const stageLabel = document.getElementById('stage-label');
const growthFill = document.getElementById('growth-fill');
const scoreEl = document.getElementById('score');
const touchControls = document.getElementById('touch-controls');
const stageUpEl = document.getElementById('stage-up');
const stageUpNameEl = document.getElementById('stage-up-name');
const gameOverEl = document.getElementById('game-over');
const titleScreen = document.getElementById('title-screen');

// ---------------- Start / restart ----------------
function applyPlayerScale() {
  const stage = player.userData.stage;
  const sm = player.userData.scaleMult || 1.0;
  player.scale.setScalar(STAGE_SCALE[stage] * sm);
}

function startGame(species) {
  if (player) scene.remove(player);
  if (entities) scene.remove(entities);

  player = buildPlayer(species);
  player.position.set(0, 0, 0);
  applyPlayerScale();
  scene.add(player);

  entities = populate(scene, player.position);
  score = 0;
  gameRunning = true;

  updateHUD();
  hudEl.classList.remove('hidden');
  touchControls.classList.remove('hidden');
  titleScreen.classList.add('hidden');
  gameOverEl.classList.add('hidden');
}

// Build the dino picker dynamically from the SPECIES registry.
function buildPicker() {
  const picker = document.getElementById('picker');
  if (!picker) return;
  picker.innerHTML = '';
  for (const key of PLAYABLE_SPECIES) {
    const spec = SPECIES[key];
    const btn = document.createElement('button');
    btn.className = 'dino-choice';
    btn.dataset.species = key;
    const hex = '#' + spec.color.toString(16).padStart(6, '0');
    btn.innerHTML = `
      <div class="dino-preview" style="background:${hex}"></div>
      <div class="dino-name">${spec.name.toUpperCase()}</div>
      <div class="dino-desc">${spec.desc}</div>
    `;
    btn.addEventListener('click', () => startGame(key));
    picker.appendChild(btn);
  }
}
buildPicker();

document.getElementById('respawn-btn').addEventListener('click', () => {
  const species = player.userData.species;
  const lostStage = Math.max(0, player.userData.stage - 1);
  scene.remove(player);
  scene.remove(entities);
  player = buildPlayer(species);
  player.userData.stage = lostStage;
  player.userData.growth = STAGE_THRESHOLD[lostStage];
  applyPlayerScale();
  player.position.set(0, 0, 0);
  scene.add(player);
  entities = populate(scene, player.position);
  gameRunning = true;
  updateHUD();
  gameOverEl.classList.add('hidden');
});

// Preload any Quaternius GLB models present in /models/.
// Always resolves — missing files just stay on procedural meshes.
preloadAllModels().then(() => {
  const s = modelStatus();
  if (s.loaded.length > 0) {
    console.log(`[DinoGrow] Loaded ${s.loaded.length}/${s.total} GLB models:`, s.loaded);
  } else {
    console.log('[DinoGrow] Using procedural dinos (no GLB models in /models/).');
  }
});

// ---------------- HUD ----------------
function updateHUD() {
  const stage = player.userData.stage;
  stageLabel.textContent = STAGE_NAMES[stage];
  const nextThreshold =
    stage < 4 ? STAGE_THRESHOLD[stage + 1] : MAX_GROWTH;
  const prevThreshold = STAGE_THRESHOLD[stage];
  const pct = Math.min(
    1,
    (player.userData.growth - prevThreshold) /
      (nextThreshold - prevThreshold)
  );
  growthFill.style.width = `${pct * 100}%`;
  scoreEl.textContent = `Score: ${score}`;
}

function showStageUp(stage) {
  stageUpNameEl.textContent = STAGE_NAMES[stage];
  stageUpEl.classList.remove('hidden');
  // restart animation
  stageUpEl.style.animation = 'none';
  void stageUpEl.offsetWidth;
  stageUpEl.style.animation = '';
  clearTimeout(showStageUp._t);
  showStageUp._t = setTimeout(() => {
    stageUpEl.classList.add('hidden');
  }, 1800);
}

// ---------------- Animation helpers ----------------
function animateDino(d, dt, moving) {
  const parts = d.userData.parts;
  // GLB models don't have procedural parts — do a whole-body bob instead.
  if (!parts || Object.keys(parts).length === 0) {
    d.userData.walkPhase = (d.userData.walkPhase || 0) + dt * (moving ? 8 : 2);
    if (d.userData.flying) {
      const base = d.userData.flyHeight || 1.5;
      d.position.y = base + Math.sin(d.userData.walkPhase * 1.2) * 0.25;
    } else {
      d.position.y = moving
        ? Math.abs(Math.sin(d.userData.walkPhase * 1.5)) * 0.08
        : 0;
    }
    return;
  }
  if (moving) {
    d.userData.walkPhase += dt * 10;
  }
  const ph = d.userData.walkPhase;
  const swing = moving ? Math.sin(ph) * 0.6 : Math.sin(ph * 0.3) * 0.05;
  // Pteranodon flaps its wings instead of stepping legs
  if (parts.flying) {
    if (parts.wingL) parts.wingL.rotation.z = 0.15 + Math.sin(ph * 1.5) * 0.4;
    if (parts.wingR) parts.wingR.rotation.z = -0.15 - Math.sin(ph * 1.5) * 0.4;
    const base = d.userData.flyHeight || 1.5;
    d.position.y = base + Math.sin(ph * 1.2) * 0.25;
    if (parts.tail2) parts.tail2.rotation.x = Math.sin(ph * 0.5) * 0.1;
    return;
  }
  if (parts.legL) parts.legL.rotation.x = swing;
  if (parts.legR) parts.legR.rotation.x = -swing;
  if (parts.quad) {
    if (parts.legBL) parts.legBL.rotation.x = -swing;
    if (parts.legBR) parts.legBR.rotation.x = swing;
  }
  if (parts.tail2) parts.tail2.rotation.y = Math.sin(ph * 0.7) * 0.15;
  if (parts.tail3) parts.tail3.rotation.y = Math.sin(ph * 0.7 + 0.4) * 0.25;
  if (parts.head)
    parts.head.position.y =
      (parts.head.userData.baseY ??= parts.head.position.y) +
      Math.sin(ph * 0.8) * 0.03;
  // Subtle body bob
  if (moving) {
    d.position.y = Math.abs(Math.sin(ph * 2)) * 0.04;
  } else {
    d.position.y *= 0.9;
  }
}

function chompAnim(d, t) {
  const parts = d.userData.parts;
  if (parts && parts.jaw) {
    parts.jaw.position.y = -0.28 + Math.sin(t * Math.PI) * 0.18;
  }
  if (parts && parts.head) {
    parts.head.rotation.x = Math.sin(t * Math.PI) * 0.4;
  }
}

// ---------------- Game loop ----------------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  controls.update();

  if (gameRunning) {
    updatePlayer(dt);
    updateEntities(dt);
    handleEating(dt);
    updateCamera(dt);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updatePlayer(dt) {
  const stage = player.userData.stage;
  const speedMult = player.userData.speedMult || 1.0;
  const baseSpeed = (4 + stage * 0.8) * speedMult;
  const mv = controls.move;
  const speed = Math.hypot(mv.x, mv.y);
  let moving = false;
  if (speed > 0.05) {
    // Move in world space; camera is fixed orientation, so input maps directly
    player.position.x += mv.x * baseSpeed * dt;
    player.position.z += mv.y * baseSpeed * dt;
    // Face direction of motion (-Z is forward in our dino model)
    const targetYaw = Math.atan2(-mv.x, -mv.y);
    let cur = player.rotation.y;
    let diff = targetYaw - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.rotation.y += diff * Math.min(1, dt * 12);
    moving = true;
  }
  // Clamp to world
  const limit = WORLD_SIZE - 2;
  player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
  player.position.z = Math.max(-limit, Math.min(limit, player.position.z));

  animateDino(player, dt, moving);

  // Chomp animation
  if (controls.chompPressed) {
    player.userData.chompTimer = 0.0001;
  }
  if (player.userData.chompTimer > 0) {
    player.userData.chompTimer += dt;
    const t = Math.min(1, player.userData.chompTimer / 0.3);
    chompAnim(player, t);
    if (t >= 1) player.userData.chompTimer = 0;
  }
}

const _tmpA = new THREE.Vector3();

function updateEntities(dt) {
  const playerStage = player.userData.stage;
  const playerScale =
    STAGE_SCALE[playerStage] * (player.userData.scaleMult || 1.0);

  for (const ent of entities.children) {
    const d = ent.userData;

    if (d.kind === 'critter') {
      // Wander, flee from player if close
      const distToPlayer = ent.position.distanceTo(player.position);
      d.wanderTimer -= dt;
      if (d.wanderTimer <= 0) {
        d.wanderDir.set(
          Math.random() - 0.5,
          0,
          Math.random() - 0.5
        ).normalize();
        d.wanderTimer = 1 + Math.random() * 2;
      }
      if (distToPlayer < 6) {
        // Flee
        d.wanderDir.copy(ent.position).sub(player.position);
        d.wanderDir.y = 0;
        d.wanderDir.normalize();
        d.fleeing = true;
      } else {
        d.fleeing = false;
      }
      const sp = d.fleeing ? d.speed * 1.5 : d.speed * 0.5;
      ent.position.x += d.wanderDir.x * sp * dt;
      ent.position.z += d.wanderDir.z * sp * dt;
      ent.rotation.y = Math.atan2(-d.wanderDir.x, -d.wanderDir.z);
      animateDino(ent, dt, true);
    } else if (d.kind === 'enemy') {
      const distToPlayer = ent.position.distanceTo(player.position);
      const enemyScale = d.scale;

      let dir = _tmpA.set(0, 0, 0);
      let moving = false;

      // Behavior: if much bigger than player -> chase
      //           if smaller than player -> flee
      //           otherwise -> wander
      const playerBigger = playerScale > enemyScale * 1.05;
      const enemyBigger = enemyScale > playerScale * 1.05;

      if (enemyBigger && distToPlayer < 25) {
        dir.copy(player.position).sub(ent.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.001) dir.normalize();
        ent.position.x += dir.x * d.speed * dt;
        ent.position.z += dir.z * d.speed * dt;
        moving = true;
      } else if (playerBigger && distToPlayer < 18) {
        dir.copy(ent.position).sub(player.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.001) dir.normalize();
        ent.position.x += dir.x * d.speed * 1.2 * dt;
        ent.position.z += dir.z * d.speed * 1.2 * dt;
        moving = true;
      } else {
        d.wanderTimer -= dt;
        if (d.wanderTimer <= 0) {
          d.wanderDir.set(
            Math.random() - 0.5,
            0,
            Math.random() - 0.5
          ).normalize();
          d.wanderTimer = 2 + Math.random() * 3;
        }
        ent.position.x += d.wanderDir.x * d.speed * 0.4 * dt;
        ent.position.z += d.wanderDir.z * d.speed * 0.4 * dt;
        dir.copy(d.wanderDir);
        moving = d.wanderDir.lengthSq() > 0.001;
      }

      if (moving) {
        const targetYaw = Math.atan2(-dir.x, -dir.z);
        let cur = ent.rotation.y;
        let diff = targetYaw - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ent.rotation.y += diff * Math.min(1, dt * 8);
      }
      animateDino(ent, dt, moving);
    }

    // Clamp to world
    const limit = WORLD_SIZE - 2;
    ent.position.x = Math.max(-limit, Math.min(limit, ent.position.x));
    ent.position.z = Math.max(-limit, Math.min(limit, ent.position.z));
  }
}

function handleEating(dt) {
  const stage = player.userData.stage;
  const playerScale = STAGE_SCALE[stage] * (player.userData.scaleMult || 1.0);
  const playerSize = playerScale * 1.5;
  // Auto-eat when collision happens; chomp button just plays animation
  // and gives a small bonus (we use it to extend reach slightly)
  const reachBoost = player.userData.chompTimer > 0 ? 1.5 : 1.0;

  // Plants
  for (let i = plants.children.length - 1; i >= 0; i--) {
    const p = plants.children[i];
    const d = p.position.distanceTo(player.position);
    if (d < (playerSize + p.userData.size) * 0.7 * reachBoost) {
      plants.remove(p);
      addGrowth(p.userData.nutrition);
      score += 1;
      // respawn a plant elsewhere
      spawnPlantRandom(plants);
    }
  }

  // Entities (critters + enemies)
  for (let i = entities.children.length - 1; i >= 0; i--) {
    const ent = entities.children[i];
    const d = ent.position.distanceTo(player.position);
    const entSize = ent.userData.size || 0.5;
    const touching = d < (playerSize + entSize) * 0.7;
    if (!touching) continue;

    if (ent.userData.kind === 'critter') {
      // Always edible
      entities.remove(ent);
      addGrowth(ent.userData.nutrition);
      score += 3;
      // Replace with a fresh one
      spawnCritter(entities, player.position);
    } else if (ent.userData.kind === 'enemy') {
      const enemyScale = ent.userData.scale;
      if (playerScale >= enemyScale * 0.95) {
        // Eat it!
        entities.remove(ent);
        addGrowth(ent.userData.nutrition);
        score += 10 + ent.userData.stage * 5;
        spawnEnemy(entities, player.position, player.userData.stage);
      } else {
        // You get eaten
        gameOver();
        return;
      }
    }
  }
}

function addGrowth(amount) {
  player.userData.growth = Math.min(
    MAX_GROWTH,
    player.userData.growth + amount
  );
  // Check stage up
  while (
    player.userData.stage < 4 &&
    player.userData.growth >= STAGE_THRESHOLD[player.userData.stage + 1]
  ) {
    player.userData.stage += 1;
    applyPlayerScale();
    showStageUp(player.userData.stage);
  }
  updateHUD();
}

function gameOver() {
  gameRunning = false;
  gameOverEl.classList.remove('hidden');
}

function updateCamera(dt) {
  // Chase cam: behind and above the player
  const stage = player.userData.stage;
  const heightOffset = 8 + stage * 1.5;
  const backOffset = 10 + stage * 2;
  // Camera looks in -Z by default; just place it behind and above
  const targetX = player.position.x;
  const targetZ = player.position.z + backOffset;
  const targetY = heightOffset;
  camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 4);
  camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 4);
  camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 4);
  camera.lookAt(player.position.x, player.position.y + 1, player.position.z);

  // Sun follows player so shadow map stays around the action
  sun.position.set(
    player.position.x + 30,
    50,
    player.position.z + 20
  );
  sunTarget.position.copy(player.position);
}

frame();
