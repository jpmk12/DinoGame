import * as THREE from 'three';
import { Controls } from './controls.js';
import {
  buildWorld,
  WORLD_SIZE,
  PLAYABLE_RADIUS,
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
import * as save from './save.js';
import * as haptics from './haptics.js';
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
import { spawnVehicles, spawnCityCars, spawnVehicle, animateVehicles } from './vehicles.js';
import { spawnCity, animateBuildings, topple } from './buildings.js';
import { LEVELS, LEVEL_KEYS, setLevelKey, getLevel, getLevelKey } from './levels.js';
import { WeatherSystem } from './weather.js';
import {
  buildHomeNest,
  animateNest,
  distanceToHome,
  isAtHome,
  HOME_RADIUS,
  HOME_REGEN_RATE,
} from './nest.js';

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

// ----- Lighting (theme-driven; re-applied on level change) -----
const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.15);
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

const rim = new THREE.DirectionalLight(0xffffff, 0.35);
scene.add(rim);

const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;

function applyLevelTheme() {
  const level = getLevel();
  hemi.color.setHex(level.hemi.sky);
  hemi.groundColor.setHex(level.hemi.ground);
  hemi.intensity = level.hemi.intensity;
  sun.color.setHex(level.sun.color);
  sun.intensity = level.sun.intensity;
  sun.position.set(...level.sun.pos);
  rim.color.setHex(level.rim.color);
  rim.intensity = level.rim.intensity;
  rim.position.set(-level.sun.pos[0], level.sun.pos[1] * 0.7, -level.sun.pos[2]);
  scene.fog = new THREE.FogExp2(level.fog.color, level.fog.density);
}
applyLevelTheme();

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
let plants = null;
let clouds = null;
let worldGroups = null; // { ground, decorations, plants, clouds, sky } — tracked for rebuild
let weather = null;
let homeNest = null;

function teardownWorld() {
  if (!worldGroups) return;
  for (const key of ['ground', 'decorations', 'plants', 'clouds', 'sky']) {
    const obj = worldGroups[key];
    if (obj) scene.remove(obj);
  }
  worldGroups = null;
  plants = null;
  clouds = null;
}

function setupWorld() {
  teardownWorld();
  worldGroups = buildWorld(scene);
  plants = worldGroups.plants;
  clouds = worldGroups.clouds;
}

setupWorld();
const particles = new ParticleSystem(scene);
weather = new WeatherSystem(scene);
weather.setKind(getLevel().weather);

// ---------------- Game state ----------------
const controls = new Controls();
let player = null;
let entities = null;     // Group of enemies + critters
let berries = null;      // Group of power-up berries
let eggs = null;         // Group of egg nests
let foods = null;        // Group of misc foods (mushrooms, fruit, beetles, etc.)
let vehicles = null;     // Group of vehicles (jeeps or cars, level-dependent)
let buildings = null;    // Group of destructible city buildings (City Rampage)
let babies = [];         // active baby dinos (THREE.Group instances)

// Title-screen game options — read at startGame.
const gameSettings = {
  startGiant: false,
  invincible: false,
  speedDemon: false,
  megaFood: false,
  mega: false,
};
let selectedLevelKey = 'lostWorld';
let homeRegenAccum = 0;
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

// Species ability state — each playable species has one signature move.
// Cooldown + name vary by species (SPECIES[key].ability).
let abilityCooldown = 0;
let activeAbility = null;     // current species ability metadata
let plateFlash = 0;           // glow boost on Titan's dorsal plates when firing
let beamMesh = null;          // active plasma beam visual
let beamLife = 0;

// Per-ability state used by charge / pounce / frenzy / etc.
let chargeTimer = 0;
let pounceTimer = 0;
let pounceStart = new THREE.Vector3();
let pounceEnd = new THREE.Vector3();
let frenzyTimer = 0;

// Pause + level-objective tracking
let paused = false;
let runStats = null;          // counters specific to the current run for objectives

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
const optSpeedCb = document.getElementById('opt-speed');
const optMegaFoodCb = document.getElementById('opt-megafood');
const optMegaCb = document.getElementById('opt-mega');
const homeIndicator = document.getElementById('home-indicator');
const compassEl = document.getElementById('compass');
const menuBtn = document.getElementById('menu-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const blastBtn = document.getElementById('blast-btn');
const blastLabel = document.getElementById('blast-label');
const compassArrow = document.getElementById('compass-arrow');
const compassDist = document.getElementById('compass-dist');
const objectiveToast = document.getElementById('objective-toast');
const objectiveText = document.getElementById('objective-text');
const objectiveProgress = document.getElementById('objective-progress');
const levelClearEl = document.getElementById('level-clear');
const levelClearScore = document.getElementById('level-clear-score');
const levelClearBest = document.getElementById('level-clear-best');
const levelClearSub = document.getElementById('level-clear-sub');
const achToastEl = document.getElementById('achievement-toast');
const achNameEl = document.getElementById('ach-name');
const achDescEl = document.getElementById('ach-desc');
const achIconEl = document.getElementById('ach-icon');
const statsPanel = document.getElementById('stats-panel');
const statsToggleBtn = document.getElementById('stats-toggle');
const statsGrid = document.getElementById('stats-grid');
const statsAchCount = document.getElementById('stats-ach-count');
const statsAchList = document.getElementById('stats-ach-list');

// ---------------- Start / restart ----------------
function applyPlayerScale() {
  const stage = player.userData.stage;
  const sm = player.userData.scaleMult || 1.0;
  const boost = power.active === 'growth' ? 1.15 : 1.0;
  const mega = gameSettings.mega ? 2.0 : 1.0;
  player.scale.setScalar(STAGE_SCALE[stage] * sm * boost * mega);
}

// Spawn vehicles appropriate to the current level (jeeps on Dino Park,
// cars on City Rampage), or null if the level has no vehicles.
function spawnLevelVehicles() {
  const level = getLevel();
  if (level.city) return spawnCityCars(scene, player.position, 9);
  if (level.vehicles) return spawnVehicles(scene, player.position, 4, level.vehicleType || 'jeep');
  return null;
}

function startGame(species) {
  audio.unlock();
  paused = false;
  pauseOverlay.classList.add('hidden');
  // Read title-screen toggles into the live settings + persist them
  gameSettings.startGiant = !!(optGiantCb && optGiantCb.checked);
  gameSettings.invincible = !!(optInvincibleCb && optInvincibleCb.checked);
  gameSettings.speedDemon = !!(optSpeedCb && optSpeedCb.checked);
  gameSettings.megaFood = !!(optMegaFoodCb && optMegaFoodCb.checked);
  gameSettings.mega = !!(optMegaCb && optMegaCb.checked);
  save.saveOptions(gameSettings);
  save.saveLastPlayed(species, selectedLevelKey);

  // Rebuild world if the chosen level differs from the active one
  if (selectedLevelKey !== getLevelKey()) {
    setLevelKey(selectedLevelKey);
    applyLevelTheme();
    setupWorld();
    if (weather) weather.setKind(getLevel().weather);
  }

  if (player) scene.remove(player);
  if (entities) scene.remove(entities);
  if (berries) scene.remove(berries);
  if (eggs) scene.remove(eggs);
  if (foods) scene.remove(foods);
  if (vehicles) scene.remove(vehicles);
  if (buildings) scene.remove(buildings);
  if (homeNest) scene.remove(homeNest);
  removeAllBabies();

  player = buildPlayer(species);
  // Roam / Mega: jump straight to GIANT (stage 4). Otherwise hatchling start.
  if (gameSettings.startGiant || gameSettings.mega) {
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
  vehicles = spawnLevelVehicles();
  buildings = getLevel().city ? spawnCity(scene, player.position) : null;
  homeNest = buildHomeNest(scene);
  homeRegenAccum = 0;
  score = 0;
  hasWon = gameSettings.startGiant; // skip win celebration if you started there
  power.active = null;
  power.timeLeft = 0;
  abilityCooldown = 0;
  chargeTimer = pounceTimer = frenzyTimer = 0;
  clearBeam();

  // Per-run counters for the objective tracker
  runStats = {
    plantsEaten: 0, dinosEaten: 0, crittersEaten: 0, foodsEaten: 0,
    babiesHatched: 0, buildingsToppled: 0, vehiclesChomped: 0,
    reachedStage: player.userData.stage, levelCleared: false,
  };

  // Configure the ability button for this species
  activeAbility = SPECIES[species] && SPECIES[species].ability || null;
  if (activeAbility) {
    blastLabel.textContent = activeAbility.name;
    blastBtn.classList.remove('hidden', 'cooldown');
  } else {
    blastBtn.classList.add('hidden');
  }

  // Stats: count this run
  save.incStat('timesPlayed');
  save.incMapStat('levelsPlayed', selectedLevelKey);
  save.incMapStat('speciesPlayed', species);

  updatePowerupHUD();
  hideBabyIndicator();
  hideEggPrompt();
  updateInvincibleHUD();
  showObjective();
  resetFacts();
  gameRunning = true;

  updateHUD();
  hudEl.classList.remove('hidden');
  touchControls.classList.remove('hidden');
  menuBtn.classList.remove('hidden');
  pauseBtn.classList.remove('hidden');
  titleScreen.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  winScreen.classList.add('hidden');
  levelClearEl.classList.add('hidden');
}

// Return to the title screen so the player can change options.
// Keeps the world rendered behind the title for a clean visual.
function exitToMenu() {
  gameRunning = false;
  paused = false;
  // Final score commit before returning to menu
  if (score > 0) save.recordBestScore(selectedLevelKey, score);
  refreshStatsPanel();
  hudEl.classList.add('hidden');
  touchControls.classList.add('hidden');
  menuBtn.classList.add('hidden');
  pauseBtn.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  blastBtn.classList.add('hidden');
  objectiveToast.classList.add('hidden');
  compassEl.classList.add('hidden');
  homeIndicator.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  winScreen.classList.add('hidden');
  levelClearEl.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  clearBeam();
}
menuBtn.addEventListener('click', exitToMenu);

function togglePause() {
  if (!gameRunning) return;
  paused = !paused;
  if (paused) {
    pauseOverlay.classList.remove('hidden');
  } else {
    pauseOverlay.classList.add('hidden');
    // Reset the clock so a long pause doesn't produce a giant dt spike
    clock.getDelta();
  }
}
pauseBtn.addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', () => {
  if (paused) togglePause();
});
document.getElementById('pause-menu-btn').addEventListener('click', () => {
  paused = false;
  pauseOverlay.classList.add('hidden');
  exitToMenu();
});

function updateInvincibleHUD() {
  if (gameSettings.invincible) invincibleIndicator.classList.remove('hidden');
  else invincibleIndicator.classList.add('hidden');
}

function removeAllBabies() {
  for (const b of babies) scene.remove(b);
  babies = [];
}

// Build the level picker dynamically.
function buildLevelPicker() {
  const root = document.getElementById('level-picker');
  if (!root) return;
  root.innerHTML = '';
  for (const key of LEVEL_KEYS) {
    const lv = LEVELS[key];
    const btn = document.createElement('button');
    btn.className = 'level-choice';
    btn.dataset.level = key;
    if (key === selectedLevelKey) btn.classList.add('selected');
    btn.innerHTML = `
      <div class="level-icon">${lv.icon}</div>
      <div class="level-name">${lv.name}</div>
      <div class="level-desc">${lv.desc}</div>
    `;
    btn.addEventListener('click', () => {
      selectedLevelKey = key;
      for (const el of root.querySelectorAll('.level-choice')) {
        el.classList.toggle('selected', el.dataset.level === key);
      }
    });
    root.appendChild(btn);
  }
}
buildLevelPicker();

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
  if (vehicles) scene.remove(vehicles);
  if (buildings) scene.remove(buildings);
  if (homeNest) scene.remove(homeNest);
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
  vehicles = spawnLevelVehicles();
  buildings = getLevel().city ? spawnCity(scene, player.position) : null;
  homeNest = buildHomeNest(scene);
  homeRegenAccum = 0;
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
  factToast.style.animation = 'none';
  void factToast.offsetWidth;
  factToast.style.animation = '';
  clearTimeout(factToastTimer);
  factToastTimer = setTimeout(() => {
    factToast.classList.add('hidden');
  }, 4000);
  // Track facts seen for the Fact Fan achievement (each shown fact counts)
  save.incStat('factsSeen');
  save.checkAchievements({ playedLevelKey: selectedLevelKey, currentStage: player && player.userData.stage });
  popAchievementToast();
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
  recordEvent('babiesHatched');
  haptics.big();
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
  const rawDt = clock.getDelta();
  controls.update();
  if (paused) {
    // Keep the renderer ticking so the pause overlay is responsive, but
    // don't advance any game state.
    if (composer) composer.render();
    else renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.05, rawDt);

  if (gameRunning) {
    updatePlayer(dt);
    updateEntities(dt);
    updateBabies(dt);
    if (berries) animateBerries(berries, dt);
    if (eggs) animateEggs(eggs, dt);
    if (foods) animateFoods(foods, dt);
    if (vehicles && animateVehicles(vehicles, dt, player.position)) audio.carHonk();
    if (buildings) animateBuildings(buildings, dt, particles);
    if (homeNest) animateNest(homeNest, dt);
    updatePowerup(dt);
    updateAbility(dt);
    updateHome(dt);
    handleEggInteraction();
    if (buildings) handleBuildings(dt);
    handleEating(dt);
    updateCamera(dt);
  }
  particles.update(dt);
  if (weather && player) weather.update(dt, player.position);

  // Decay screen shake
  if (shake > 0) shake = Math.max(0, shake - dt * 1.5);

  // Drift the clouds across the sky
  if (clouds) animateClouds(clouds, dt);

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function updateHome(dt) {
  if (!homeNest || !player) {
    if (homeIndicator) homeIndicator.classList.add('hidden');
    if (compassEl) compassEl.classList.add('hidden');
    return;
  }
  const dist = distanceToHome(homeNest, player.position);
  const atHome = dist < HOME_RADIUS;

  // Show home indicator + passive regen while inside the nest
  if (atHome) {
    homeIndicator.classList.remove('hidden');
    compassEl.classList.add('hidden');
    homeRegenAccum += dt * HOME_REGEN_RATE;
    if (homeRegenAccum >= 1) {
      const ticks = Math.floor(homeRegenAccum);
      homeRegenAccum -= ticks;
      // Grow gently while resting (skip stage-up celebration spam)
      const prevStage = player.userData.stage;
      player.userData.growth = Math.min(
        MAX_GROWTH,
        player.userData.growth + ticks
      );
      while (
        player.userData.stage < 4 &&
        player.userData.growth >= STAGE_THRESHOLD[player.userData.stage + 1]
      ) {
        player.userData.stage += 1;
        applyPlayerScale();
        showStageUp(player.userData.stage);
        audio.stageUp();
        if (player.userData.stage === 4) triggerWin();
      }
      updateHUD();
    }
  } else {
    homeIndicator.classList.add('hidden');
    homeRegenAccum = 0;
    // Show the homeward compass when far enough away
    if (dist > 30) {
      compassEl.classList.remove('hidden');
      const dx = homeNest.position.x - player.position.x;
      const dz = homeNest.position.z - player.position.z;
      // Camera looks toward -Z; compute relative bearing in screen space
      const yaw = Math.atan2(dx, -dz);
      compassArrow.style.transform = `rotate(${yaw}rad)`;
      compassDist.textContent = Math.round(dist) + 'u';
    } else {
      compassEl.classList.add('hidden');
    }
  }
}

// ---------------- Stats / Achievements / Objectives ----------------
function recordEvent(kind, n = 1) {
  if (!runStats) return;
  runStats[kind] = (runStats[kind] || 0) + n;
  save.incStat(kind, n);
  save.checkAchievements({ playedLevelKey: selectedLevelKey, currentStage: player.userData.stage });
  popAchievementToast();
  updateObjectiveProgress();
  checkObjectiveComplete();
}

let achToastTimer = null;
function popAchievementToast() {
  if (achToastTimer) return; // already showing one
  const key = save.popNewAchievement();
  if (!key) return;
  const a = save.ACHIEVEMENTS[key];
  achIconEl.textContent = a.icon;
  achNameEl.textContent = a.name;
  achDescEl.textContent = a.desc;
  achToastEl.classList.remove('hidden');
  achToastEl.style.animation = 'none';
  void achToastEl.offsetWidth;
  achToastEl.style.animation = '';
  haptics.big();
  achToastTimer = setTimeout(() => {
    achToastEl.classList.add('hidden');
    achToastTimer = null;
    popAchievementToast(); // chain
  }, 4200);
}

function objectiveCurrent() {
  if (!runStats) return 0;
  const obj = getLevel().objective;
  if (!obj) return 0;
  switch (obj.kind) {
    case 'reachStage':     return runStats.reachedStage;
    case 'eatDinos':       return runStats.dinosEaten;
    case 'eatCritters':    return runStats.crittersEaten;
    case 'chompVehicles':  return runStats.vehiclesChomped;
    case 'hatchBabies':    return runStats.babiesHatched;
    case 'topple':         return runStats.buildingsToppled;
    default: return 0;
  }
}

function updateObjectiveProgress() {
  if (!runStats) return;
  const obj = getLevel().objective;
  if (!obj) return;
  objectiveProgress.textContent = Math.min(objectiveCurrent(), obj.value) + '/' + obj.value;
}

function showObjective() {
  if (!runStats) return;
  const obj = getLevel().objective;
  if (!obj) { objectiveToast.classList.add('hidden'); return; }
  objectiveText.textContent = obj.text;
  updateObjectiveProgress();
  objectiveToast.classList.remove('hidden');
}

function checkObjectiveComplete() {
  if (!runStats || runStats.levelCleared) return;
  const obj = getLevel().objective;
  if (!obj) return;
  if (objectiveCurrent() >= obj.value) {
    runStats.levelCleared = true;
    triggerLevelClear();
  }
}

function triggerLevelClear() {
  audio.win();
  const burstPos = player.position.clone();
  burstPos.y += 5;
  particles.confetti(burstPos);
  shake = Math.max(shake, 0.5);
  haptics.huge();
  const newBest = save.recordBestScore(selectedLevelKey, score);
  save.markCompleted(selectedLevelKey);
  levelClearScore.textContent = 'Score: ' + score;
  levelClearSub.textContent = getLevel().objective.text + ' — Done!';
  levelClearBest.classList.toggle('hidden', !newBest);
  levelClearEl.classList.remove('hidden');
}

document.getElementById('level-clear-continue').addEventListener('click', () => {
  levelClearEl.classList.add('hidden');
});
document.getElementById('level-clear-menu').addEventListener('click', exitToMenu);

function refreshStatsPanel() {
  if (!statsGrid) return;
  const s = save.loadSave();
  statsGrid.innerHTML = '';
  for (const key of LEVEL_KEYS) {
    const lv = LEVELS[key];
    const card = document.createElement('div');
    card.className = 'stat-level-card';
    if (s.completed[key]) card.classList.add('completed');
    const best = s.bestScores[key] || 0;
    card.innerHTML = `
      <div class="stat-icon">${lv.icon}</div>
      <div>${lv.name}</div>
      <div class="stat-score">${best > 0 ? 'Best: ' + best : '—'}</div>
    `;
    statsGrid.appendChild(card);
  }
  const allKeys = Object.keys(save.ACHIEVEMENTS);
  statsAchCount.textContent = `${s.achievements.length} / ${allKeys.length}`;
  statsAchList.innerHTML = '';
  for (const k of allKeys) {
    const a = save.ACHIEVEMENTS[k];
    const chip = document.createElement('div');
    chip.className = 'ach-chip' + (s.achievements.includes(k) ? ' unlocked' : '');
    chip.textContent = a.icon;
    chip.title = `${a.name}: ${a.desc}`;
    statsAchList.appendChild(chip);
  }
}

statsToggleBtn.addEventListener('click', () => {
  const wasHidden = statsPanel.classList.contains('hidden');
  if (wasHidden) {
    refreshStatsPanel();
    statsPanel.classList.remove('hidden');
    statsToggleBtn.textContent = '📊 Hide stats';
  } else {
    statsPanel.classList.add('hidden');
    statsToggleBtn.textContent = '📊 Show stats';
  }
});

function applySavedOptions() {
  const s = save.loadSave();
  if (optGiantCb)      optGiantCb.checked      = !!s.options.startGiant;
  if (optInvincibleCb) optInvincibleCb.checked = !!s.options.invincible;
  if (optSpeedCb)      optSpeedCb.checked      = !!s.options.speedDemon;
  if (optMegaFoodCb)   optMegaFoodCb.checked   = !!s.options.megaFood;
  if (optMegaCb)       optMegaCb.checked       = !!s.options.mega;
  if (s.lastLevel && LEVELS[s.lastLevel]) selectedLevelKey = s.lastLevel;
  // Re-render the level picker so the saved selection is highlighted
  buildLevelPicker();
}
applySavedOptions();
refreshStatsPanel();

// ---------------- Titan Plasma Breath ----------------
function clearBeam() {
  if (beamMesh) {
    scene.remove(beamMesh);
    if (beamMesh.geometry) beamMesh.geometry.dispose();
    if (beamMesh.material) beamMesh.material.dispose();
    beamMesh = null;
  }
  beamLife = 0;
}

function spawnBeam(origin, fwd, scale) {
  clearBeam();
  const length = 20 + scale * 6;
  const geo = new THREE.CylinderGeometry(0.7 * scale, 0.22 * scale, length, 14, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x9fe4ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Cylinder runs along +Y by default — rotate so +Y aligns with fwd.
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    fwd.clone().normalize()
  );
  mesh.position.copy(origin).add(fwd.clone().multiplyScalar(length / 2));
  mesh.renderOrder = 2;
  scene.add(mesh);
  beamMesh = mesh;
  beamLife = 0.4;
  // Sparkle burst at the muzzle
  particles.sparkles(origin);
}

function consumeInCone(origin, fwd, range, coneCos) {
  const apex = true; // beam vaporizes anything regardless of size
  const eat = (group, handler) => {
    if (!group) return;
    for (let i = group.children.length - 1; i >= 0; i--) {
      const obj = group.children[i];
      const to = _tmpA.copy(obj.position).sub(origin);
      const dist = to.length();
      if (dist > range || dist < 0.001) continue;
      to.multiplyScalar(1 / dist);
      if (to.dot(fwd) < coneCos) continue;
      handler(obj);
    }
  };

  eat(entities, (ent) => {
    particles.meat(ent.position);
    entities.remove(ent);
    addGrowth(ent.userData.nutrition || 2);
    if (ent.userData.kind === 'enemy') {
      score += 10 + ent.userData.stage * 5;
      recordEvent('dinosEaten');
      spawnEnemy(entities, player.position, player.userData.stage);
    } else {
      score += 3;
      recordEvent('crittersEaten');
      spawnCritter(entities, player.position);
    }
  });

  eat(foods, (f) => {
    const pType = f.userData.particleType || 'leaves';
    if (particles[pType]) particles[pType](f.position);
    foods.remove(f);
    addGrowth(f.userData.nutrition || 1);
    score += f.userData.score || 1;
    recordEvent('foodsEaten');
    if (f.userData.foodType === 'watermelon') recordEvent('watermelonsEaten');
    spawnFood(foods, player.position, f.userData.foodType);
  });

  eat(vehicles, (v) => {
    particles.debris(v.position);
    vehicles.remove(v);
    addGrowth(v.userData.nutrition || 3);
    score += v.userData.score || 25;
    recordEvent('vehiclesChomped');
    setTimeout(() => {
      if (gameRunning && vehicles) spawnVehicle(vehicles, player.position);
    }, 5000);
  });

  if (buildings) {
    let leveled = 0;
    eat(buildings, (b) => {
      if (b.userData.kind !== 'building' || b.userData.falling) return;
      topple(b, origin.x, origin.z);
      score += b.userData.score;
      recordEvent('buildingsToppled');
      leveled++;
    });
    if (leveled > 0) {
      audio.crumble();
      shake = Math.max(shake, 0.5);
    }
  }
}

function firePlasmaBreath() {
  audio.plasmaBreath();
  plateFlash = 0.6;
  setTimeout(() => {
    if (!gameRunning || !player || player.userData.species !== 'titan') return;
    const yaw = player.rotation.y;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const scale = player.scale.x;
    const mouth = player.position.clone();
    mouth.y += 2.4 * scale;
    mouth.add(fwd.clone().multiplyScalar(scale));
    spawnBeam(mouth, fwd, scale);
    shake = Math.max(shake, 0.4);
    haptics.huge();
    const range = 20 + scale * 6;
    consumeInCone(mouth, fwd, range, Math.cos(0.5));
  }, 280);
}

// ---- Per-species ability implementations ----
function fireRoar() {
  audio.abilityRoar();
  particles.sparkles(player.position.clone().add(new THREE.Vector3(0, 2, 0)));
  shake = Math.max(shake, 0.3);
  haptics.big();
  // All enemies within 22 units flee for 3 seconds regardless of size
  if (!entities) return;
  for (const ent of entities.children) {
    if (ent.userData.kind === 'enemy' || ent.userData.kind === 'critter') {
      const d = ent.position.distanceTo(player.position);
      if (d < 22) ent.userData.fleeTimer = 3.0;
    }
  }
}

function fireCharge() {
  audio.abilityCharge();
  chargeTimer = 1.4; // seconds of charge
  haptics.big();
  shake = Math.max(shake, 0.2);
}

function fireSweep() {
  audio.abilitySweep();
  particles.dust(player.position);
  shake = Math.max(shake, 0.3);
  haptics.big();
  // 360° area: vaporize anything within 9 units, including buildings
  const here = player.position;
  const r = 9 + player.scale.x * 1.5;
  consumeAround(here, r);
}

function firePounce() {
  audio.abilityPounce();
  // Leap forward in current facing direction
  const yaw = player.rotation.y;
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  pounceStart.copy(player.position);
  pounceEnd.copy(player.position).add(fwd.multiplyScalar(12));
  pounceTimer = 0.45;
}

function fireStomp() {
  audio.abilityStomp();
  particles.dust(player.position);
  shake = Math.max(shake, 0.6);
  haptics.huge();
  // Stun all enemies within 16 units for 2s
  if (!entities) return;
  for (const ent of entities.children) {
    if (ent.userData.kind === 'enemy' || ent.userData.kind === 'critter') {
      const d = ent.position.distanceTo(player.position);
      if (d < 16) ent.userData.stunTimer = 2.0;
    }
  }
}

function fireFrenzy() {
  audio.abilityFrenzy();
  particles.sparkles(player.position.clone().add(new THREE.Vector3(0, 1, 0)));
  frenzyTimer = 5.0;
  haptics.big();
}

function fireAbility(kind) {
  if (!activeAbility) return;
  abilityCooldown = activeAbility.cooldown;
  blastBtn.classList.add('cooldown');
  save.incStat('abilityUses');
  if (kind === 'plasma') {
    save.incStat('plasmaUses');
    firePlasmaBreath();
  } else if (kind === 'roar')   fireRoar();
  else if (kind === 'charge')   fireCharge();
  else if (kind === 'sweep')    fireSweep();
  else if (kind === 'pounce')   firePounce();
  else if (kind === 'stomp')    fireStomp();
  else if (kind === 'frenzy')   fireFrenzy();
  save.checkAchievements({ playedLevelKey: selectedLevelKey, currentStage: player.userData.stage });
  popAchievementToast();
}

// AOE consume (Sweep). Hits enemies, critters, food, vehicles, buildings.
function consumeAround(origin, range) {
  const r2 = range * range;
  const check = (group, handler) => {
    if (!group) return;
    for (let i = group.children.length - 1; i >= 0; i--) {
      const obj = group.children[i];
      const dx = obj.position.x - origin.x;
      const dz = obj.position.z - origin.z;
      if (dx * dx + dz * dz > r2) continue;
      handler(obj);
    }
  };
  check(entities, (ent) => {
    if (ent.userData.kind !== 'enemy' && ent.userData.kind !== 'critter') return;
    particles.meat(ent.position);
    entities.remove(ent);
    addGrowth(ent.userData.nutrition || 2);
    if (ent.userData.kind === 'enemy') {
      score += 10 + ent.userData.stage * 5;
      recordEvent('dinosEaten');
      spawnEnemy(entities, player.position, player.userData.stage);
    } else {
      score += 3;
      recordEvent('crittersEaten');
      spawnCritter(entities, player.position);
    }
  });
  check(foods, (f) => {
    const pType = f.userData.particleType || 'leaves';
    if (particles[pType]) particles[pType](f.position);
    foods.remove(f);
    addGrowth(f.userData.nutrition || 1);
    score += f.userData.score || 1;
    recordEvent('foodsEaten');
    if (f.userData.foodType === 'watermelon') recordEvent('watermelonsEaten');
    spawnFood(foods, player.position, f.userData.foodType);
  });
  check(vehicles, (v) => {
    particles.debris(v.position);
    vehicles.remove(v);
    addGrowth(v.userData.nutrition || 3);
    score += v.userData.score || 25;
    recordEvent('vehiclesChomped');
    setTimeout(() => { if (gameRunning && vehicles) spawnVehicle(vehicles, player.position); }, 5000);
  });
  if (buildings) {
    let leveled = 0;
    check(buildings, (b) => {
      if (b.userData.kind !== 'building' || b.userData.falling) return;
      topple(b, origin.x, origin.z);
      score += b.userData.score;
      recordEvent('buildingsToppled');
      leveled++;
    });
    if (leveled > 0) { audio.crumble(); shake = Math.max(shake, 0.4); }
  }
}

function updateAbility(dt) {
  if (abilityCooldown > 0) {
    abilityCooldown -= dt;
    if (abilityCooldown <= 0) {
      abilityCooldown = 0;
      blastBtn.classList.remove('cooldown');
    }
  }
  if (activeAbility && controls.blastPressed && abilityCooldown <= 0) {
    fireAbility(activeAbility.kind);
  }

  // Dorsal plate glow flares while firing, then settles (Titan only)
  if (plateFlash > 0) {
    plateFlash = Math.max(0, plateFlash - dt);
    const plates = player.userData.parts && player.userData.parts.plates;
    if (plates && plates[0]) {
      plates[0].material.emissiveIntensity = 0.9 + plateFlash * 5;
    }
  }

  // Fade out the plasma beam
  if (beamMesh) {
    beamLife -= dt;
    beamMesh.material.opacity = Math.max(0, beamLife / 0.4) * 0.85;
    if (beamLife <= 0) clearBeam();
  }

  // Pounce: arc forward and auto-eat on landing
  if (pounceTimer > 0) {
    const t = 1 - pounceTimer / 0.45;
    pounceTimer = Math.max(0, pounceTimer - dt);
    player.position.x = pounceStart.x + (pounceEnd.x - pounceStart.x) * t;
    player.position.z = pounceStart.z + (pounceEnd.z - pounceStart.z) * t;
    if (pounceTimer === 0) {
      // Landing burst — eat anything close
      consumeAround(player.position, 3.5 * Math.max(1, player.scale.x));
      shake = Math.max(shake, 0.25);
      particles.dust(player.position);
    }
  }

  // Frenzy: 5s of apex eating, handled in handleEating via gameSettings flag
  if (frenzyTimer > 0) frenzyTimer = Math.max(0, frenzyTimer - dt);
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
  const demonSpeed = gameSettings.speedDemon ? 2.0 : 1.0;
  const frenzySpeed = frenzyTimer > 0 ? 2.0 : 1.0;
  let baseSpeed = (4 + stage * 0.8) * speedMult * powerSpeed * demonSpeed * frenzySpeed;

  // Triceratops Charge — short directional burst that runs over things
  let moving = false;
  if (chargeTimer > 0) {
    chargeTimer = Math.max(0, chargeTimer - dt);
    const yaw = player.rotation.y;
    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);
    const chargeSpeed = baseSpeed * 3.0;
    player.position.x += dx * chargeSpeed * dt;
    player.position.z += dz * chargeSpeed * dt;
    moving = true;
    // Sweep-style autoeat in a forward arc as we plow through
    consumeAround(player.position, player.scale.x * 3);
    if (Math.random() < 0.6) particles.dust(player.position);
  } else {
    const mv = controls.move;
    const speed = Math.hypot(mv.x, mv.y);
    if (speed > 0.05) {
      player.position.x += mv.x * baseSpeed * dt;
      player.position.z += mv.y * baseSpeed * dt;
      const targetYaw = Math.atan2(-mv.x, -mv.y);
      let cur = player.rotation.y;
      let diff = targetYaw - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.rotation.y += diff * Math.min(1, dt * 12);
      moving = true;
    }
  }

  const limit = PLAYABLE_RADIUS;
  player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
  player.position.z = Math.max(-limit, Math.min(limit, player.position.z));

  animateDino(player, dt, moving);

  if (moving && stage >= 3) {
    stepThumpTimer -= dt;
    if (stepThumpTimer <= 0) {
      const mega = gameSettings.mega;
      stepThumpTimer = mega ? 0.4 : (stage >= 4 ? 0.5 : 0.65);
      audio.step();
      particles.dust(player.position);
      if (mega) { shake = Math.max(shake, 0.4); haptics.stomp(); }
      else if (stage >= 4) { shake = Math.max(shake, 0.12); haptics.tap(); }
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
  // Use the actual rendered scale so all multipliers (scaleMult, growth
  // boost, Mega Mode) factor into predator/prey behavior.
  const playerScale = player.scale.x;

  for (const ent of entities.children) {
    const d = ent.userData;

    // Stun (Stomp ability): freeze in place while the timer runs
    if (d.stunTimer > 0) {
      d.stunTimer -= dt;
      animateDino(ent, dt, false);
      continue;
    }
    // Forced flee (Roar ability): override behavior and run from player
    if (d.fleeTimer > 0) {
      d.fleeTimer -= dt;
      const ax = ent.position.x - player.position.x;
      const az = ent.position.z - player.position.z;
      const al = Math.hypot(ax, az) || 1;
      const sp = (d.speed || 3) * 1.6;
      ent.position.x += (ax / al) * sp * dt;
      ent.position.z += (az / al) * sp * dt;
      ent.rotation.y = Math.atan2(-(ax / al), -(az / al));
      const lim = PLAYABLE_RADIUS - 2;
      ent.position.x = Math.max(-lim, Math.min(lim, ent.position.x));
      ent.position.z = Math.max(-lim, Math.min(lim, ent.position.z));
      animateDino(ent, dt, true);
      continue;
    }

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
    const limit = PLAYABLE_RADIUS;
    ent.position.x = Math.max(-limit, Math.min(limit, ent.position.x));
    ent.position.z = Math.max(-limit, Math.min(limit, ent.position.z));
  }
}

// City buildings: topple them if the player is big enough, otherwise they
// block the player (the dino is too small to knock them over).
function handleBuildings(dt) {
  const playerScale = player.scale.x;
  const playerSize = playerScale * 1.5;
  for (let i = buildings.children.length - 1; i >= 0; i--) {
    const b = buildings.children[i];
    if (b.userData.kind !== 'building' || b.userData.falling) continue;
    const dx = player.position.x - b.position.x;
    const dz = player.position.z - b.position.z;
    const dist = Math.hypot(dx, dz);
    const touchDist = playerSize * 0.7 + b.userData.radius;
    if (dist > touchDist) continue;

    if (playerScale >= b.userData.toughness) {
      // Big enough — smash it down!
      topple(b, player.position.x, player.position.z);
      audio.crumble();
      score += b.userData.score;
      recordEvent('buildingsToppled');
      haptics.huge();
      shake = Math.max(shake, 0.45);
    } else {
      // Too small — get pushed out of the building's footprint
      const len = dist || 1;
      const nx = dx / len;
      const nz = dz / len;
      player.position.x = b.position.x + nx * touchDist;
      player.position.z = b.position.z + nz * touchDist;
    }
  }
}

function handleEating(dt) {
  const stage = player.userData.stage;
  const playerScale = player.scale.x; // actual rendered scale (incl. Mega Mode)
  const playerSize = playerScale * 1.5;
  const reachBoost = player.userData.chompTimer > 0 ? 1.5 : 1.0;
  const megaMult = gameSettings.megaFood ? 3.0 : 1.0;
  const growthMult = (power.active === 'growth' ? 2.0 : 1.0) * megaMult;
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
      recordEvent('plantsEaten');
      haptics.tap();
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
        recordEvent('foodsEaten');
        if (ft === 'watermelon') recordEvent('watermelonsEaten');
        haptics.chomp();
        // Respawn the same food type elsewhere to keep biome variety stable
        spawnFood(foods, player.position, ft);
      }
    }
  }

  // Ranger jeeps — chomp for big points (Dino Park levels)
  if (vehicles) {
    for (let i = vehicles.children.length - 1; i >= 0; i--) {
      const v = vehicles.children[i];
      const d = v.position.distanceTo(player.position);
      if (d < (playerSize + v.userData.size) * 0.7 * reachBoost) {
        particles.debris(v.position);
        audio.crunchMetal();
        shake = Math.max(shake, 0.3);
        vehicles.remove(v);
        addGrowth((v.userData.nutrition || 1) * growthMult);
        score += v.userData.score || 25;
        recordEvent('vehiclesChomped');
        haptics.big();
        showFact('You chomped a ranger jeep! +' + (v.userData.score || 25));
        // A replacement jeep drives in after a short delay
        setTimeout(() => {
          if (gameRunning && vehicles) spawnVehicle(vehicles, player.position);
        }, 5000);
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
      recordEvent('crittersEaten');
      haptics.chomp();
      showFact(factForCritter());
      spawnCritter(entities, player.position);
    } else if (ent.userData.kind === 'enemy') {
      const enemyScale = ent.userData.scale;
      const canEat = apex || gameSettings.invincible || frenzyTimer > 0 ||
                     playerScale >= enemyScale * 0.95;
      if (canEat) {
        particles.meat(ent.position);
        if (ent.userData.stage >= 3) audio.chompBig();
        else audio.chompCritter();
        showFact(factForSpecies(ent.userData.species));
        entities.remove(ent);
        addGrowth(ent.userData.nutrition * growthMult);
        score += 10 + ent.userData.stage * 5;
        recordEvent('dinosEaten');
        haptics.big();
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
    if (runStats) {
      runStats.reachedStage = Math.max(runStats.reachedStage || 0, player.userData.stage);
      save.checkAchievements({ playedLevelKey: selectedLevelKey, currentStage: player.userData.stage });
      popAchievementToast();
      updateObjectiveProgress();
      checkObjectiveComplete();
    }
    if (player.userData.stage === 4) {
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
  // Pull the camera back for a bigger player so the whole beast stays in frame.
  const sizeBoost = gameSettings.mega ? 2.2 : 1.0;
  const heightOffset = (8 + stage * 1.5) * sizeBoost;
  const backOffset = (10 + stage * 2) * sizeBoost;
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
