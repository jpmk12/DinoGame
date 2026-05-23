import * as THREE from 'three';
import { Controls } from './controls.js';
import {
  buildWorld,
  WORLD_SIZE,
  spawnPlantRandom,
  getHeightAt,
  animateClouds,
} from './world.js';
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
import { audio } from './audio.js';
import { ParticleSystem } from './particles.js';
import {
  spawnBerries,
  spawnBerry,
  animateBerries,
  POWERUP_TYPES,
} from './powerups.js';
import { factForSpecies, factForCritter, resetFacts } from './facts.js';
import {
  spawnEggs,
  spawnEgg,
  animateEggs,
  eggNearby,
  tapEgg,
  buildBabyDino,
  EGG_TAPS_TO_HATCH,
  BABY_DURATION,
  BABY_EAT_RADIUS,
} from './eggs.js';
import { spawnFoods, spawnFood, animateFoods } from './foods.js';

// Tell the boot watchdog (defined in index.html) that the module loaded
// successfully and all imports resolved.
if (window.__dinoBoot) window.__dinoBoot.stage = 'imports-resolved';

// ---------------- Scene / renderer setup ----------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
// Warm tinted exponential fog — sky color matches the horizon for a soft blend.
scene.fog = new THREE.FogExp2(0xeac49a, 0.011);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
camera.position.set(0, 8, 12);

// ----- Lighting -----
// Hemisphere fills shadows with sky/ground tones (much more natural than flat ambient).
const hemi = new THREE.HemisphereLight(0xb0d4f0, 0x4a5a30, 0.65);
scene.add(hemi);

// Warm directional sun — golden-hour vibe.
const sun = new THREE.DirectionalLight(0xfff1cf, 1.15);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// Cool rim/back light from the opposite side. Just barely there, but it
// puts a hint of separation around silhouettes against the ground.
const rim = new THREE.DirectionalLight(0xa8c8ff, 0.35);
rim.position.set(-40, 40, -30);
scene.add(rim);

const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;

// ---------------- Post-processing (bloom) ----------------
// Lazy-loaded; if the CDN modules fail we silently fall back to direct
// rendering with no glow. Game still works.
let composer = null;
let bloomPass = null;
(async () => {
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
      await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
    const w = window.innerWidth;
    const h = window.innerHeight;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.45, 0.78);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch (err) {
    console.warn('[DinoGrow] Bloom unavailable, falling back to plain render:', err);
    composer = null;
  }
})();

// ---------------- Resize ----------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(w, h);
    if (bloomPass) bloomPass.setSize(w, h);
  }
}
window.addEventListener('resize', resize);
resize();

// ---------------- World ----------------
const { plants, clouds } = buildWorld(scene);
const particles = new ParticleSystem(scene);

// ---------------- Game state ----------------
const controls = new Controls();
let player = null;
let entities = null;     // Group of enemies + critters
let berries = null;      // Group of power-up berries
let eggs = null;         // Group of egg nests
let foods = null;        // Group of misc foods (mushrooms, fruit, beetles, etc.)
let babies = [];         // active baby dinos (THREE.Group instances)

// Title-screen game options — read at startGame.
const gameSettings = {
  startGiant: false,
  invincible: false,
};
let score = 0;
let gameRunning = false;
let hasWon = false;      // win celebration only shows once per run
let shake = 0;           // current screen-shake intensity
let stepThumpTimer = 0;  // throttles giant-stage footstep sounds

// Active power-up state on the player
const power = {
  active: null,    // 'speed' | 'growth' | 'apex' | null
  timeLeft: 0,
};

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
const powerupIndicator = document.getElementById('powerup-indicator');
const powerupIcon = document.getElementById('powerup-icon');
const powerupName = document.getElementById('powerup-name');
const powerupTimer = document.getElementById('powerup-timer');
const factToast = document.getElementById('fact-toast');
const factText = document.getElementById('fact-text');
const winScreen = document.getElementById('win-screen');
const winScoreEl = document.getElementById('win-score');
const babyIndicator = document.getElementById('baby-indicator');
const babyTimerEl = document.getElementById('baby-timer');
const eggPrompt = document.getElementById('egg-prompt');
const eggProgressFill = document.getElementById('egg-progress-fill');
const invincibleIndicator = document.getElementById('invincible-indicator');
const optGiantCb = document.getElementById('opt-giant');
const optInvincibleCb = document.getElementById('opt-invincible');

// ---------------- Start / restart ----------------
function applyPlayerScale() {
  const stage = player.userData.stage;
  const sm = player.userData.scaleMult || 1.0;
  const boost = power.active === 'growth' ? 1.15 : 1.0;
  player.scale.setScalar(STAGE_SCALE[stage] * sm * boost);
}

function startGame(species) {
  audio.unlock();
  // Read title-screen toggles into the live settings
  gameSettings.startGiant = !!(optGiantCb && optGiantCb.checked);
  gameSettings.invincible = !!(optInvincibleCb && optInvincibleCb.checked);

  if (player) scene.remove(player);
  if (entities) scene.remove(entities);
  if (berries) scene.remove(berries);
  if (eggs) scene.remove(eggs);
  if (foods) scene.remove(foods);
  removeAllBabies();

  player = buildPlayer(species);
  // Roam mode: jump straight to GIANT (stage 4). Otherwise normal hatchling start.
  if (gameSettings.startGiant) {
    player.userData.stage = 4;
    player.userData.growth = STAGE_THRESHOLD[4];
  }
  player.position.set(0, getHeightAt(0, 0), 0);
  applyPlayerScale();
  scene.add(player);

  entities = populate(scene, player.position);
  berries = spawnBerries(scene, player.position, 5);
  eggs = spawnEggs(scene, player.position, 4);
  foods = spawnFoods(scene, player.position);
  score = 0;
  hasWon = gameSettings.startGiant; // skip win celebration if you started there
  power.active = null;
  power.timeLeft = 0;
  updatePowerupHUD();
  hideBabyIndicator();
  hideEggPrompt();
  updateInvincibleHUD();
  resetFacts();
  gameRunning = true;

  updateHUD();
  hudEl.classList.remove('hidden');
  touchControls.classList.remove('hidden');
  titleScreen.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  winScreen.classList.add('hidden');
}

function updateInvincibleHUD() {
  if (gameSettings.invincible) invincibleIndicator.classList.remove('hidden');
  else invincibleIndicator.classList.add('hidden');
}

function removeAllBabies() {
  for (const b of babies) scene.remove(b);
  babies = [];
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
if (window.__dinoBoot) window.__dinoBoot.stage = 'main-ran';

document.getElementById('respawn-btn').addEventListener('click', () => {
  audio.unlock();
  const species = player.userData.species;
  const lostStage = Math.max(0, player.userData.stage - 1);
  scene.remove(player);
  scene.remove(entities);
  if (berries) scene.remove(berries);
  if (eggs) scene.remove(eggs);
  if (foods) scene.remove(foods);
  removeAllBabies();
  player = buildPlayer(species);
  player.userData.stage = lostStage;
  player.userData.growth = STAGE_THRESHOLD[lostStage];
  applyPlayerScale();
  player.position.set(0, getHeightAt(0, 0), 0);
  scene.add(player);
  entities = populate(scene, player.position);
  berries = spawnBerries(scene, player.position, 5);
  eggs = spawnEggs(scene, player.position, 4);
  foods = spawnFoods(scene, player.position);
  power.active = null;
  power.timeLeft = 0;
  updatePowerupHUD();
  hideBabyIndicator();
  hideEggPrompt();
  gameRunning = true;
  updateHUD();
  gameOverEl.classList.add('hidden');
});

document.getElementById('win-continue').addEventListener('click', () => {
  winScreen.classList.add('hidden');
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

function updatePowerupHUD() {
  if (!power.active) {
    powerupIndicator.classList.add('hidden');
    return;
  }
  const info = POWERUP_TYPES[power.active];
  powerupIcon.textContent = info.icon;
  powerupName.textContent = info.name;
  powerupTimer.textContent = Math.ceil(power.timeLeft) + 's';
  powerupIndicator.classList.remove('hidden');
}

function activatePowerup(type) {
  power.active = type;
  power.timeLeft = POWERUP_TYPES[type].duration;
  audio.powerup();
  particles.sparkles(player.position);
  applyPlayerScale();
  updatePowerupHUD();
}

let factToastTimer = null;
function showFact(text) {
  if (!text) return;
  factText.textContent = text;
  factToast.classList.remove('hidden');
  // restart animation
  factToast.style.animation = 'none';
  void factToast.offsetWidth;
  factToast.style.animation = '';
  clearTimeout(factToastTimer);
  factToastTimer = setTimeout(() => {
    factToast.classList.add('hidden');
  }, 4000);
}

function triggerWin() {
  if (hasWon) return;
  hasWon = true;
  winScoreEl.textContent = 'Final Score: ' + score;
  winScreen.classList.remove('hidden');
  audio.win();
  // Big confetti burst above the player
  const pos = player.position.clone();
  pos.y += 4;
  particles.confetti(pos);
  shake = Math.max(shake, 0.4);
}

// ---------------- Egg / baby helpers ----------------
function showEggPrompt(cracks) {
  eggPrompt.classList.remove('hidden');
  const pct = (cracks / EGG_TAPS_TO_HATCH) * 100;
  eggProgressFill.style.width = pct + '%';
}

function hideEggPrompt() {
  eggPrompt.classList.add('hidden');
  eggProgressFill.style.width = '0%';
}

function showBabyIndicator(timeLeft) {
  babyIndicator.classList.remove('hidden');
  babyTimerEl.textContent = Math.ceil(timeLeft) + 's';
}

function hideBabyIndicator() {
  babyIndicator.classList.add('hidden');
}

function hatchEgg(eggRoot) {
  const pos = eggRoot.position.clone();
  pos.y += 0.6;
  particles.sparkles(pos);
  particles.confetti(pos);
  audio.eggHatch();
  shake = Math.max(shake, 0.2);
  score += 15;
  showFact('A baby hatched! It will help you eat for ' + BABY_DURATION + ' seconds!');

  // Spawn the baby — same species as the player for a "your baby" feel
  const baby = buildBabyDino(player.userData.species);
  baby.position.copy(eggRoot.position);
  scene.add(baby);
  babies.push(baby);

  // Remove the egg, queue a respawn elsewhere
  if (eggs) {
    eggs.remove(eggRoot);
    setTimeout(() => {
      if (gameRunning && eggs) spawnEgg(eggs, player.position);
    }, 10000);
  }
}

const _babyTmp = new THREE.Vector3();

function updateBabies(dt) {
  if (babies.length === 0) {
    hideBabyIndicator();
    return;
  }

  // Show indicator with the longest-lived baby's remaining time
  let maxLife = 0;
  for (const b of babies) maxLife = Math.max(maxLife, b.userData.lifetime);
  showBabyIndicator(maxLife);

  for (let i = babies.length - 1; i >= 0; i--) {
    const baby = babies[i];
    baby.userData.lifetime -= dt;
    if (baby.userData.lifetime <= 0) {
      // Goodbye animation: sparkle and remove
      particles.sparkles(baby.position);
      scene.remove(baby);
      babies.splice(i, 1);
      continue;
    }

    // Find the nearest small food (plant, food item, or critter) within 6 units
    let target = null;
    let targetDist = 6;
    let targetGroup = null;

    if (plants) {
      for (const p of plants.children) {
        const d = baby.position.distanceTo(p.position);
        if (d < targetDist) {
          target = p;
          targetDist = d;
          targetGroup = plants;
        }
      }
    }
    if (foods) {
      for (const f of foods.children) {
        // Babies skip the big watermelons — leave them for the player
        if (f.userData.foodType === 'watermelon') continue;
        const d = baby.position.distanceTo(f.position);
        if (d < targetDist) {
          target = f;
          targetDist = d;
          targetGroup = foods;
        }
      }
    }
    if (entities) {
      for (const ent of entities.children) {
        if (ent.userData.kind !== 'critter') continue;
        const d = baby.position.distanceTo(ent.position);
        if (d < targetDist) {
          target = ent;
          targetDist = d;
          targetGroup = entities;
        }
      }
    }

    // Choose goal: target food, else trail the player at an offset
    let goalX, goalZ;
    if (target) {
      goalX = target.position.x;
      goalZ = target.position.z;
    } else {
      const ang = baby.userData.followAngle;
      const offset = 1.8;
      goalX = player.position.x + Math.cos(ang) * offset;
      goalZ = player.position.z + Math.sin(ang) * offset;
    }

    // Move toward goal
    const dx = goalX - baby.position.x;
    const dz = goalZ - baby.position.z;
    const dist = Math.hypot(dx, dz);
    const speed = target ? 6 : 5;
    let moving = false;
    if (dist > 0.05) {
      const step = Math.min(dist, speed * dt);
      baby.position.x += (dx / dist) * step;
      baby.position.z += (dz / dist) * step;
      const yaw = Math.atan2(-(dx / dist), -(dz / dist));
      baby.rotation.y = yaw;
      moving = true;
    }
    animateDino(baby, dt, moving);

    // Eat if close enough
    if (target && targetDist < BABY_EAT_RADIUS) {
      const kind = target.userData.kind;
      const nutrition = target.userData.nutrition || 1;
      // Particle by food type, falling back to meat/leaves
      const pType = target.userData.particleType ||
                    (kind === 'plant' ? 'leaves' : 'meat');
      if (particles[pType]) particles[pType](target.position);
      audio.chompPlant();
      targetGroup.remove(target);
      addGrowth(nutrition);
      score += (target.userData.score) || (kind === 'plant' ? 1 : 2);
      // Replenish what was eaten so the world stays populated
      if (kind === 'plant') spawnPlantRandom(plants);
      else if (kind === 'food') spawnFood(foods, player.position, target.userData.foodType);
      else spawnCritter(entities, player.position);
    }

    // Occasional chirp
    baby.userData.chirpTimer -= dt;
    if (baby.userData.chirpTimer <= 0) {
      audio.babyChirp();
      baby.userData.chirpTimer = 4 + Math.random() * 5;
    }
  }
}

function handleEggInteraction() {
  if (!eggs) {
    hideEggPrompt();
    return;
  }
  const near = eggNearby(eggs, player.position);
  if (!near) {
    hideEggPrompt();
    return;
  }
  showEggPrompt(near.userData.cracks);
  if (controls.chompPressed) {
    audio.eggCrack();
    particles.dust(near.position);
    const hatched = tapEgg(near);
    showEggPrompt(near.userData.cracks);
    if (hatched) {
      hatchEgg(near);
      hideEggPrompt();
    }
  }
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
  const groundY = getHeightAt(d.position.x, d.position.z);
  const parts = d.userData.parts;
  // GLB models don't have procedural parts — do a whole-body bob instead.
  if (!parts || Object.keys(parts).length === 0) {
    d.userData.walkPhase = (d.userData.walkPhase || 0) + dt * (moving ? 8 : 2);
    if (d.userData.flying) {
      const base = d.userData.flyHeight || 1.5;
      d.position.y = groundY + base + Math.sin(d.userData.walkPhase * 1.2) * 0.25;
    } else {
      const bob = moving
        ? Math.abs(Math.sin(d.userData.walkPhase * 1.5)) * 0.08
        : 0;
      d.position.y = groundY + bob;
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
    d.position.y = groundY + base + Math.sin(ph * 1.2) * 0.25;
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
  // Body sits on terrain plus subtle bob
  const bob = moving ? Math.abs(Math.sin(ph * 2)) * 0.04 : 0;
  d.position.y = groundY + bob;
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
    updateBabies(dt);
    if (berries) animateBerries(berries, dt);
    if (eggs) animateEggs(eggs, dt);
    if (foods) animateFoods(foods, dt);
    updatePowerup(dt);
    handleEggInteraction();
    handleEating(dt);
    updateCamera(dt);
  }
  particles.update(dt);

  // Decay screen shake
  if (shake > 0) shake = Math.max(0, shake - dt * 1.5);

  // Drift the clouds across the sky
  if (clouds) animateClouds(clouds, dt);

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updatePowerup(dt) {
  if (!power.active) return;
  power.timeLeft -= dt;
  if (power.timeLeft <= 0) {
    audio.powerupExpire();
    const wasGrowth = power.active === 'growth';
    power.active = null;
    power.timeLeft = 0;
    if (wasGrowth) applyPlayerScale();
  }
  updatePowerupHUD();
}

function updatePlayer(dt) {
  const stage = player.userData.stage;
  const speedMult = player.userData.speedMult || 1.0;
  const powerSpeed = power.active === 'speed' ? 2.0 : 1.0;
  const baseSpeed = (4 + stage * 0.8) * speedMult * powerSpeed;
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

  // Giant-stage footsteps: thump sound + dust + tiny camera shake
  if (moving && stage >= 3) {
    stepThumpTimer -= dt;
    if (stepThumpTimer <= 0) {
      const interval = stage >= 4 ? 0.5 : 0.65;
      stepThumpTimer = interval;
      audio.step();
      particles.dust(player.position);
      if (stage >= 4) shake = Math.max(shake, 0.12);
    }
  }

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
  const reachBoost = player.userData.chompTimer > 0 ? 1.5 : 1.0;
  const growthMult = power.active === 'growth' ? 2.0 : 1.0;
  const apex = power.active === 'apex';

  // Plants
  for (let i = plants.children.length - 1; i >= 0; i--) {
    const p = plants.children[i];
    const d = p.position.distanceTo(player.position);
    if (d < (playerSize + p.userData.size) * 0.7 * reachBoost) {
      particles.leaves(p.position);
      audio.chompPlant();
      plants.remove(p);
      addGrowth(p.userData.nutrition * growthMult);
      score += 1;
      spawnPlantRandom(plants);
    }
  }

  // Foods (mushrooms, fruit, beetles, etc.)
  if (foods) {
    for (let i = foods.children.length - 1; i >= 0; i--) {
      const f = foods.children[i];
      const d = f.position.distanceTo(player.position);
      if (d < (playerSize + f.userData.size) * 0.7 * reachBoost) {
        const ft = f.userData.foodType;
        const pType = f.userData.particleType || 'leaves';
        if (particles[pType]) particles[pType](f.position);
        // Pick sound per food type
        if (ft === 'watermelon') {
          audio.chompBig();
          shake = Math.max(shake, 0.15);
        } else if (ft === 'beetle') {
          audio.chompCritter();
        } else {
          audio.chompPlant();
        }
        foods.remove(f);
        addGrowth((f.userData.nutrition || 1) * growthMult);
        score += f.userData.score || 1;
        // Respawn the same food type elsewhere to keep biome variety stable
        spawnFood(foods, player.position, ft);
      }
    }
  }

  // Berries (power-ups)
  if (berries) {
    for (let i = berries.children.length - 1; i >= 0; i--) {
      const b = berries.children[i];
      const d = b.position.distanceTo(player.position);
      if (d < playerSize + 0.6) {
        activatePowerup(b.userData.berryType);
        berries.remove(b);
        // Respawn a new berry elsewhere after a delay
        setTimeout(() => {
          if (gameRunning && berries) spawnBerry(berries, player.position);
        }, 6000);
      }
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
      particles.meat(ent.position);
      audio.chompCritter();
      entities.remove(ent);
      addGrowth(ent.userData.nutrition * growthMult);
      score += 3;
      showFact(factForCritter());
      spawnCritter(entities, player.position);
    } else if (ent.userData.kind === 'enemy') {
      const enemyScale = ent.userData.scale;
      const canEat = apex || gameSettings.invincible || playerScale >= enemyScale * 0.95;
      if (canEat) {
        particles.meat(ent.position);
        // Sound depends on the enemy's size
        if (ent.userData.stage >= 3) audio.chompBig();
        else audio.chompCritter();
        // Show fact the first time we eat this species
        showFact(factForSpecies(ent.userData.species));
        entities.remove(ent);
        addGrowth(ent.userData.nutrition * growthMult);
        score += 10 + ent.userData.stage * 5;
        // Camera shake scales with prey size
        shake = Math.max(shake, 0.1 + ent.userData.stage * 0.05);
        spawnEnemy(entities, player.position, player.userData.stage);
      } else {
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
    audio.stageUp();
    const pos = player.position.clone();
    pos.y += 1;
    particles.sparkles(pos);
    shake = Math.max(shake, 0.25);
    if (player.userData.stage === 4) {
      // Reaching GIANT triggers the celebration once per run
      triggerWin();
    }
  }
  updateHUD();
}

function gameOver() {
  gameRunning = false;
  audio.gameOver();
  particles.meat(player.position);
  shake = 0.35;
  gameOverEl.classList.remove('hidden');
}

function updateCamera(dt) {
  // Chase cam: behind and above the player. Height tracks terrain so the
  // camera stays the right distance off the ground when on hills or valleys.
  const stage = player.userData.stage;
  const heightOffset = 8 + stage * 1.5;
  const backOffset = 10 + stage * 2;
  const targetX = player.position.x;
  const targetZ = player.position.z + backOffset;
  const targetY = player.position.y + heightOffset;
  camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 4);
  camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 4);
  camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 4);
  // Screen shake offset (decays in frame())
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake * 0.5;
  }
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
