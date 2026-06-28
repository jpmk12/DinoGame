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
  buildCritterEnt,
  STAGE_NAMES,
  STAGE_SCALE,
  STAGE_THRESHOLD,
  MAX_GROWTH,
} from './entities.js';
import { SPECIES, PLAYABLE_SPECIES } from './dinos.js';
import { preloadAllModels, modelStatus, attachMixer, setMotion, triggerAttack, tickAttackTimers } from './modelLoader.js';
import * as save from './save.js';
import * as haptics from './haptics.js';
import { updateWater, buildWaterRect } from './water.js';
import { spawnBoss, updateBoss, damageBoss, BOSS_DATA } from './bosses.js';
import { ProjectilePool } from './projectiles.js';
import { spawnAirEnemies, updateAirEnemies } from './airEnemies.js';
import { spawnGroundMilitary, updateGroundMilitary } from './groundMilitary.js';
import { spawnKaiju, updateKaiju, kaijuBlocksAOE } from './kaiju.js';
import { spawnLandmarks, updateLandmarks } from './landmarks.js';
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

// ---- Day/night cycle ----
// Smoothly transitions sky, sun, hemi, and fog between the level's daytime
// palette and a generic night palette over a fixed period.
const NIGHT_HEMI    = { sky: 0x1a2a45, ground: 0x10131a, intensity: 0.30 };
const NIGHT_SUN     = { color: 0x88a4d8, intensity: 0.30 };
const NIGHT_SKY     = { top: 0x06091a, mid: 0x14203a, bottom: 0x2a1830, glow: [0.06, 0.04, 0.10] };
const NIGHT_FOG     = 0x0c1228;
const CYCLE_SECONDS = 90;
let dayPhase = Math.PI / 2; // start at midday

const _cA = new THREE.Color();
const _cB = new THREE.Color();
function lerpHex(a, b, t) { _cA.setHex(a); _cB.setHex(b); return _cA.lerp(_cB, t); }

function updateDayNight(dt) {
  if (!gameSettings.dayNight) return;
  const level = getLevel();
  // Skip on levels whose entire identity is night
  if (level.nightCity || level.weather === 'fireflies') return;

  dayPhase = (dayPhase + dt * (Math.PI * 2 / CYCLE_SECONDS)) % (Math.PI * 2);
  const t = (Math.sin(dayPhase) + 1) / 2; // 0=midnight, 1=noon

  hemi.intensity = level.hemi.intensity * t + NIGHT_HEMI.intensity * (1 - t);
  hemi.color.copy(lerpHex(NIGHT_HEMI.sky, level.hemi.sky, t));
  hemi.groundColor.copy(lerpHex(NIGHT_HEMI.ground, level.hemi.ground, t));

  sun.intensity = level.sun.intensity * Math.max(0.08, t);
  sun.color.copy(lerpHex(NIGHT_SUN.color, level.sun.color, t));

  // Sun arcs across the sky — radius preserved from level's preset.
  const radius = Math.hypot(level.sun.pos[0], level.sun.pos[2]) || 30;
  sun.position.x = Math.cos(dayPhase) * radius;
  sun.position.z = Math.sin(dayPhase) * radius;
  sun.position.y = Math.max(8, level.sun.pos[1] * (0.3 + t * 0.7));

  const skyMat = worldGroups && worldGroups.sky && worldGroups.sky.material;
  if (skyMat && skyMat.uniforms) {
    skyMat.uniforms.topColor.value.copy(lerpHex(NIGHT_SKY.top, level.sky.top, t));
    skyMat.uniforms.midColor.value.copy(lerpHex(NIGHT_SKY.mid, level.sky.mid, t));
    skyMat.uniforms.bottomColor.value.copy(lerpHex(NIGHT_SKY.bottom, level.sky.bottom, t));
    skyMat.uniforms.glow.value.set(
      NIGHT_SKY.glow[0] * (1 - t) + level.sky.glow[0] * t,
      NIGHT_SKY.glow[1] * (1 - t) + level.sky.glow[1] * t,
      NIGHT_SKY.glow[2] * (1 - t) + level.sky.glow[2] * t,
    );
  }
  if (scene.fog && scene.fog.color) {
    scene.fog.color.copy(lerpHex(NIGHT_FOG, level.fog.color, t));
  }
}

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
let boss = null;         // current level boss (mesh) or null when defeated
let airEnemies = null;   // Group of flying threats (helicopters, jets, drones)
let groundMilitary = null; // Group of ground military (tanks, silos, soldiers)
let kaiju = null;        // Group of rival kaiju (Mecha Titan, Crab, Moth, Scorpion)
let landmarks = null;    // Group of level-specific structures (oil rigs, reactors, etc.)
let projectiles = null;  // ProjectilePool — lazily created once
let playerHitFlash = 0;  // brief red tint when struck by a missile
let bossDefeated = false;
// Grace period so kids can grow before the boss shows up. Set in startGame
// + respawn. The boss spawns when this hits 0 (or never, if already
// defeated for this run).
const BOSS_SPAWN_DELAY = 45;
// Master switch — bosses temporarily disabled while we tune the difficulty
// curve for young kids. Flip back to true to restore per-level bosses.
const BOSSES_ENABLED = false;
let bossSpawnTimer = 0;
let babies = [];         // active baby dinos (THREE.Group instances)

// Title-screen game options — read at startGame.
const gameSettings = {
  startGiant: false,
  invincible: false,
  speedDemon: false,
  megaFood: false,
  mega: false,
  dayNight: false,
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

// Titan-only state for the chord-rich input scheme.
let titanBeamMode = null;        // 'sweep' | 'mega' | null
let titanSweepTickCd = 0;        // throttle Beam Sweep cone consumes
let megaBeamLife = 0;            // discharge time after a Mega Beam fires
let beamSweepArmed = false;      // true once hold passes the threshold; reset on release
let quakeTimer = 0;              // current Stomp Quake leap-slam timer
let quakeApex = 0;
let quakeCooldown = 0;
const QUAKE_DURATION = 0.7;
const QUAKE_COOLDOWN = 6;
const PLASMA_PULSE_COST = 25;
const BEAM_SWEEP_HOLD_THRESHOLD = 0.42;
const MEGA_BEAM_HOLD_THRESHOLD = 1.0;

// Pause + level-objective tracking
let paused = false;
let runStats = null;          // counters specific to the current run for objectives

// Tutorial state — a sequence of hint bubbles shown only on first run.
const TUTORIAL_STEPS = [
  { text: 'Tap and drag on the LEFT side of the screen to move your dino!' },
  { text: 'Walk into plants and small critters to EAT them and grow.' },
  { text: 'Tap CHOMP near eggs to hatch baby helpers. Each dino has a special ABILITY button too!' },
  { text: 'Reach the GIANT stage to win, then check the OBJECTIVE up top for a bonus goal!' },
];
let tutorialStep = -1;

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
const atomicIndicator = document.getElementById('atomic-indicator');
const atomicFill = document.getElementById('atomic-fill');
const atomicLabel = document.getElementById('atomic-label');
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
const optDayNightCb = document.getElementById('opt-daynight');
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
const bossBar = document.getElementById('boss-bar');
const bossNameEl = document.getElementById('boss-name');
const bossHpFill = document.getElementById('boss-hp-fill');
const tutorialBubble = document.getElementById('tutorial-bubble');
const tutorialText = document.getElementById('tutorial-text');
const tutorialNext = document.getElementById('tutorial-next');

function showTutorialStep(i) {
  if (i < 0 || i >= TUTORIAL_STEPS.length) {
    tutorialBubble.classList.add('hidden');
    save.setTutorialDone();
    tutorialStep = -1;
    return;
  }
  tutorialStep = i;
  tutorialText.textContent = TUTORIAL_STEPS[i].text;
  tutorialBubble.classList.remove('hidden');
}
tutorialNext.addEventListener('click', () => showTutorialStep(tutorialStep + 1));

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
  gameSettings.dayNight = !!(optDayNightCb && optDayNightCb.checked);
  save.saveOptions(gameSettings);
  save.saveLastPlayed(species, selectedLevelKey);

  // Rebuild world if the chosen level differs from the active one
  if (selectedLevelKey !== getLevelKey()) {
    setLevelKey(selectedLevelKey);
    applyLevelTheme();
    setupWorld();
    if (weather) weather.setKind(getLevel().weather);
  }
  // Re-apply the day theme each game so the day/night cycle starts fresh
  applyLevelTheme();
  dayPhase = Math.PI / 2;

  if (player) scene.remove(player);
  if (entities) scene.remove(entities);
  if (berries) scene.remove(berries);
  if (eggs) scene.remove(eggs);
  if (foods) scene.remove(foods);
  if (vehicles) scene.remove(vehicles);
  if (buildings) scene.remove(buildings);
  if (homeNest) scene.remove(homeNest);
  if (boss) { scene.remove(boss); boss = null; }
  if (airEnemies) { scene.remove(airEnemies); airEnemies = null; }
  if (groundMilitary) { scene.remove(groundMilitary); groundMilitary = null; }
  if (kaiju) { scene.remove(kaiju); kaiju = null; }
  if (landmarks) { scene.remove(landmarks); landmarks = null; }
  if (projectiles) projectiles.clearAll();
  bossDefeated = false;
  bossBar.classList.add('hidden');
  removeAllBabies();

  player = buildPlayer(species);
  // Roam / Mega: jump straight to GIANT (stage 4). Otherwise hatchling start.
  if (gameSettings.startGiant || gameSettings.mega) {
    player.userData.stage = 4;
    player.userData.growth = STAGE_THRESHOLD[4];
  }
  // Atomic Charge — Titan's stomp-to-unleash meter. Other species
  // still get the field (cheap) but addAtomicCharge is a no-op for them.
  player.userData.atomicCharge = 0;
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
  if (!projectiles) projectiles = new ProjectilePool(scene);
  airEnemies = spawnAirEnemies(scene, player.position, getAirEnemyCounts(selectedLevelKey));
  groundMilitary = spawnGroundMilitary(scene, player.position, getGroundMilitaryCounts(selectedLevelKey));
  kaiju = spawnKaiju(scene, player.position, getKaijuCounts(selectedLevelKey));
  landmarks = spawnLandmarks(scene, getLevel(), player.position);
  // Boss spawns AFTER a grace period so the dino has time to grow first.
  // updateBossTick ticks the timer down each frame.
  bossSpawnTimer = BOSS_DATA[selectedLevelKey] ? BOSS_SPAWN_DELAY : 0;
  score = 0;
  hasWon = gameSettings.startGiant; // skip win celebration if you started there
  power.active = null;
  power.timeLeft = 0;
  abilityCooldown = 0;
  chargeTimer = pounceTimer = frenzyTimer = 0;
  titanBeamMode = null;
  titanSweepTickCd = 0;
  megaBeamLife = 0;
  beamSweepArmed = false;
  quakeTimer = 0;
  quakeCooldown = 0;
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
  // First-run tutorial — show the first bubble at game start
  if (!save.tutorialDone()) showTutorialStep(0);
  else tutorialBubble.classList.add('hidden');

  updateHUD();
  updateAtomicHUD();
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
  if (score > 0) save.recordBestScore(selectedLevelKey, score);
  refreshStatsPanel();
  refreshUnlockStates();
  hudEl.classList.add('hidden');
  touchControls.classList.add('hidden');
  menuBtn.classList.add('hidden');
  pauseBtn.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  blastBtn.classList.add('hidden');
  objectiveToast.classList.add('hidden');
  bossBar.classList.add('hidden');
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
  if (boss) { scene.remove(boss); boss = null; }
  bossDefeated = false;
  bossBar.classList.add('hidden');
  removeAllBabies();
  player = buildPlayer(species);
  player.userData.stage = lostStage;
  player.userData.growth = STAGE_THRESHOLD[lostStage];
  // Wipe Atomic Charge on respawn — pay the cost of dying.
  player.userData.atomicCharge = 0;
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
  if (airEnemies) { scene.remove(airEnemies); }
  if (groundMilitary) { scene.remove(groundMilitary); }
  if (kaiju) { scene.remove(kaiju); }
  if (landmarks) { scene.remove(landmarks); }
  if (projectiles) projectiles.clearAll();
  airEnemies = spawnAirEnemies(scene, player.position, getAirEnemyCounts(selectedLevelKey));
  groundMilitary = spawnGroundMilitary(scene, player.position, getGroundMilitaryCounts(selectedLevelKey));
  kaiju = spawnKaiju(scene, player.position, getKaijuCounts(selectedLevelKey));
  landmarks = spawnLandmarks(scene, getLevel(), player.position);
  // Same grace period after game-over respawn so the boss doesn't pile on
  // a fresh, smaller dino immediately.
  bossSpawnTimer = BOSS_DATA[selectedLevelKey] ? BOSS_SPAWN_DELAY : 0;
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
  const el = document.getElementById('model-status-text');
  const wrap = document.getElementById('model-status');
  if (s.loaded.length > 0) {
    const fmt = (s.format || 'glb').toUpperCase();
    console.log(`[DinoGrow] Loaded ${s.loaded.length}/${s.total} ${fmt} models:`, s.loaded);
    if (el && wrap) {
      el.textContent = `🦴 ${s.loaded.length} / ${s.total} animated ${fmt} models loaded`;
      wrap.classList.add('glb');
    }
  } else {
    console.log('[DinoGrow] Using procedural dinos (no model files in /models/).');
    if (el) el.textContent = 'Using procedural meshes — drop GLB or FBX files in /models/ for animated dinos';
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

// Atomic Charge meter — Titan only. Hidden for every other species.
function updateAtomicHUD() {
  if (!atomicIndicator) return;
  if (!player || player.userData.species !== 'titan') {
    atomicIndicator.classList.add('hidden');
    return;
  }
  const charge = player.userData.atomicCharge || 0;
  const pct = Math.min(100, charge);
  atomicFill.style.width = pct + '%';
  const full = pct >= ATOMIC_CHARGE_MAX;
  atomicIndicator.classList.toggle('full', full);
  if (full) atomicLabel.textContent = 'MEGA READY — HOLD!';
  else      atomicLabel.textContent = Math.round(pct) + '%';
  atomicIndicator.classList.remove('hidden');
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
      baby.rotation.y = yaw + (baby.userData.faceFlip || 0);
      moving = true;
    }
    baby.userData.motionNorm = moving ? (target ? 0.9 : 0.5) : 0;
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
  // Each dino owns its own idle phase so they don't breathe in unison.
  if (d.userData.idlePhase === undefined) {
    d.userData.idlePhase = Math.random() * Math.PI * 2;
  }
  d.userData.idlePhase += dt;
  const ip = d.userData.idlePhase;

  // GLB/FBX models don't have procedural parts. If the model also has a
  // real skeletal AnimationMixer (its walk clip is already cycling), we
  // leave the vertical position flat so the bob doesn't add a hop on top
  // of the real walk. Otherwise (no mixer = static model), do the body bob
  // so it doesn't look frozen.
  if (!parts || Object.keys(parts).length === 0) {
    d.userData.walkPhase = (d.userData.walkPhase || 0) + dt * (moving ? 8 : 2);
    if (d.userData.flying) {
      const base = d.userData.flyHeight || 1.5;
      d.position.y = groundY + base + Math.sin(d.userData.walkPhase * 1.2) * 0.25;
    } else if (d.userData.mixer) {
      // Tiny breathing rise for mixer-driven dinos in case the idle clip
      // doesn't add any chest motion of its own. Stays sub-cm so it never
      // reads as a hop.
      d.position.y = groundY + (moving ? 0 : Math.sin(ip * 1.5) * 0.012);
    } else {
      const bob = moving
        ? Math.abs(Math.sin(d.userData.walkPhase * 1.5)) * 0.08
        : Math.sin(ip * 1.5) * 0.025; // idle breathing
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
    const flapRate = moving ? 1.5 : 0.9;
    const flapAmp = moving ? 0.4 : 0.18;
    if (parts.wingL) parts.wingL.rotation.z = 0.15 + Math.sin(ph * flapRate) * flapAmp;
    if (parts.wingR) parts.wingR.rotation.z = -0.15 - Math.sin(ph * flapRate) * flapAmp;
    const base = d.userData.flyHeight || 1.5;
    d.position.y = groundY + base + Math.sin(ph * 1.2) * 0.25;
    if (parts.tail2) parts.tail2.rotation.x = Math.sin(ph * 0.5) * 0.1;
    if (parts.head) {
      const baseRotY = (parts.head.userData.baseRotY ??= parts.head.rotation.y);
      parts.head.rotation.y = baseRotY + Math.sin(ip * 0.5) * 0.18;
    }
    return;
  }
  if (parts.legL) parts.legL.rotation.x = swing;
  if (parts.legR) parts.legR.rotation.x = -swing;
  if (parts.quad) {
    if (parts.legBL) parts.legBL.rotation.x = -swing;
    if (parts.legBR) parts.legBR.rotation.x = swing;
  }
  // Tail always sways — more aggressive when walking, subtle when idle
  const tailAmpA = moving ? 0.15 : 0.10;
  const tailAmpB = moving ? 0.25 : 0.18;
  const tailRate = moving ? 0.7 : 0.5;
  if (parts.tail2) parts.tail2.rotation.y = Math.sin(ph * tailRate) * tailAmpA + Math.sin(ip * 0.7) * 0.06;
  if (parts.tail3) parts.tail3.rotation.y = Math.sin(ph * tailRate + 0.4) * tailAmpB + Math.sin(ip * 0.7 + 0.5) * 0.08;
  if (parts.head) {
    const baseY = (parts.head.userData.baseY ??= parts.head.position.y);
    const baseRotY = (parts.head.userData.baseRotY ??= parts.head.rotation.y);
    parts.head.position.y = baseY + Math.sin(ph * 0.8) * 0.03 + Math.sin(ip * 0.9) * 0.025;
    // Look-around yaw — bigger when idle, smaller when walking
    parts.head.rotation.y = baseRotY + Math.sin(ip * 0.35) * (moving ? 0.06 : 0.18);
  }
  // Body sits on terrain plus subtle bob — even when idle there's a
  // gentle breathing rise so the dino looks alive instead of frozen.
  const bob = moving
    ? Math.abs(Math.sin(ph * 2)) * 0.04
    : Math.sin(ip * 1.5) * 0.025;
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
  controls.update(Math.min(0.05, rawDt));
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
    if (landmarks) animateBuildings(landmarks, dt, particles);
    if (airEnemies) updateAirEnemies(airEnemies, dt, player.position, projectiles);
    if (groundMilitary) updateGroundMilitary(groundMilitary, dt, player.position, projectiles);
    if (kaiju) updateKaiju(kaiju, dt, player.position, onKaijuTouch, onMothLarva);
    if (landmarks) updateLandmarks(landmarks, dt, player.position);
    if (projectiles) projectiles.update(dt, player.position, player.scale.x * 1.5, onMissileHitPlayer);
    if (playerHitFlash > 0) playerHitFlash = Math.max(0, playerHitFlash - dt);
    updateBossTick(dt);
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
  updateDayNight(dt);

  // Decay screen shake
  if (shake > 0) shake = Math.max(0, shake - dt * 1.5);

  // Drift the clouds across the sky
  if (clouds) animateClouds(clouds, dt);

  updateWater(rawDt);
  pumpMixers(dt);
  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// GLB skeletal animation: lazily attach a mixer to any instance that has
// pending animations; tick all active mixers every frame.
function pumpMixers(dt) {
  const ensure = (o) => {
    if (o && o.userData && o.userData.pendingMixer) {
      o.userData.pendingMixer = false;
      attachMixer(o, THREE);
    }
  };
  if (player) ensure(player);
  if (entities) for (const e of entities.children) ensure(e);
  for (const b of babies) ensure(b);

  // Tick all mixers + attack timers
  if (player && player.userData.mixer) {
    player.userData.mixer.update(dt);
    tickAttackTimers(player, dt);
  }
  if (entities) {
    for (const e of entities.children) {
      if (e.userData.mixer) {
        e.userData.mixer.update(dt);
        tickAttackTimers(e, dt);
      }
    }
  }
  for (const b of babies) {
    if (b.userData.mixer) {
      b.userData.mixer.update(dt);
      tickAttackTimers(b, dt);
    }
  }
  if (boss && boss.userData.mixer) {
    boss.userData.mixer.update(dt);
    tickAttackTimers(boss, dt);
  }

  // Drive every mixer-equipped dino by the motion intent recorded during
  // the entity update. Player intent factors in input speed + abilities;
  // entities expose `motionNorm` on userData; boss is always charging.
  if (player && player.userData.mixer) {
    const mv = controls.move;
    let target = Math.hypot(mv.x, mv.y);
    if (chargeTimer > 0 || pounceTimer > 0 || frenzyTimer > 0) target = 1.0;
    setMotion(player, target);
  }
  if (entities) {
    for (const e of entities.children) {
      if (!e.userData.mixer) continue;
      setMotion(e, e.userData.motionNorm || 0);
    }
  }
  for (const b of babies) {
    if (!b.userData.mixer) continue;
    setMotion(b, b.userData.motionNorm || 0.4);
  }
  if (boss && boss.userData.mixer && !boss.userData.dying) {
    setMotion(boss, 1.0);
  }
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

// ---------------- Boss handling ----------------
function updateBossTick(dt) {
  if (!BOSSES_ENABLED) {
    if (boss) { scene.remove(boss); boss = null; }
    bossBar.classList.add('hidden');
    return;
  }
  // Grace period: count down to spawn, then summon the boss once.
  if (!boss && !bossDefeated && bossSpawnTimer > 0) {
    bossSpawnTimer -= dt;
    if (bossSpawnTimer <= 0 && BOSS_DATA[selectedLevelKey]) {
      boss = spawnBoss(scene, player.position, selectedLevelKey);
    }
  }
  if (!boss) { bossBar.classList.add('hidden'); return; }
  // Boss danger ring — same green/red signal as regular enemies
  if (boss.userData.dangerRingMat && !boss.userData.dying) {
    const apexMode = power.active === 'apex' || gameSettings.invincible || frenzyTimer > 0;
    const safe = apexMode || player.scale.x >= boss.userData.scaleVal * 0.95;
    boss.userData.dangerRingMat.color.setHex(safe ? 0x2aff3a : 0xff3a3a);
    boss.userData.dangerRingMat.opacity = 0.6 + Math.sin(performance.now() * 0.006) * 0.2;
  }
  const r = updateBoss(boss, dt, player.position);
  if (r.dead) {
    onBossDefeated();
    return;
  }
  // Boss touched the player — knockback + damage if vulnerable
  if (r.hit && !boss.userData.dying) {
    if (!gameSettings.invincible && frenzyTimer <= 0 && chargeTimer <= 0) {
      const playerScale = player.scale.x;
      const enemyScale = boss.userData.scaleVal;
      if (playerScale < enemyScale * 0.95) {
        // Boss eats player → game over
        gameOver();
        return;
      }
    }
    // Knockback + small chomp-damage from contact
    const dx = player.position.x - boss.position.x;
    const dz = player.position.z - boss.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const push = 2.5;
    boss.position.x -= (dx / len) * push;
    boss.position.z -= (dz / len) * push;
    const reward = damageBoss(boss, 1);
    audio.chompBig();
    shake = Math.max(shake, 0.2);
    if (reward > 0) {
      score += reward;
      onBossDefeated();
    }
  }
  // Update healthbar
  bossBar.classList.remove('hidden');
  bossNameEl.textContent = boss.userData.name;
  const pct = (boss.userData.health / boss.userData.maxHealth) * 100;
  bossHpFill.style.width = pct + '%';
}

function onBossDefeated() {
  if (bossDefeated) return;
  bossDefeated = true;
  const pos = boss ? boss.position.clone() : player.position.clone();
  particles.confetti(pos);
  particles.sparkles(pos);
  shake = Math.max(shake, 0.6);
  haptics.huge();
  audio.win();
  score += boss ? boss.userData.score : 100;
  showFact('BOSS DEFEATED! ' + (boss && boss.userData.name) + ' has fallen!');
  save.incStat('bossesDefeated');
  save.checkAchievements({ playedLevelKey: selectedLevelKey, currentStage: player.userData.stage });
  popAchievementToast();
  setTimeout(() => {
    if (boss) { scene.remove(boss); boss = null; }
    bossBar.classList.add('hidden');
  }, 1400);
}

// Missile-hit handler — gentle for kids. Small growth loss, screen
// flash, brief shake. No game-over from rockets, ever.
function onMissileHitPlayer(p) {
  if (!player || !gameRunning) return;
  if (gameSettings.invincible) return;
  audio.crunchMetal && audio.crunchMetal();
  particles.debris(p.mesh.position.clone());
  shake = Math.max(shake, 0.45);
  haptics.big();
  playerHitFlash = 0.4;
  player.userData.growth = Math.max(
    STAGE_THRESHOLD[player.userData.stage],
    player.userData.growth - 3,
  );
  updateHUD();
  // Tiny knockback away from impact
  const dx = player.position.x - p.mesh.position.x;
  const dz = player.position.z - p.mesh.position.z;
  const d = Math.hypot(dx, dz) || 1;
  player.position.x += (dx / d) * 0.6;
  player.position.z += (dz / d) * 0.6;
}

// Kaiju touch — small knockback + tiny growth loss, no game-over.
function onKaijuTouch(ent) {
  if (!player || !gameRunning || gameSettings.invincible) return;
  audio.crunchMetal && audio.crunchMetal();
  shake = Math.max(shake, 0.5);
  haptics.huge();
  playerHitFlash = 0.4;
  player.userData.growth = Math.max(
    STAGE_THRESHOLD[player.userData.stage],
    player.userData.growth - 4,
  );
  updateHUD();
  const dx = player.position.x - ent.position.x;
  const dz = player.position.z - ent.position.z;
  const d = Math.hypot(dx, dz) || 1;
  player.position.x += (dx / d) * 1.0;
  player.position.z += (dz / d) * 1.0;
}

// Giant Moth periodically drops larvae that hatch into critters.
function onMothLarva(worldPos) {
  if (!entities) return;
  const cr = buildCritterEnt();
  cr.position.set(
    worldPos.x + (Math.random() - 0.5) * 4,
    getHeightAt(worldPos.x, worldPos.z),
    worldPos.z + (Math.random() - 0.5) * 4,
  );
  entities.add(cr);
  particles.sparkles(cr.position);
}

function downKaiju(ent) {
  if (!kaiju) return;
  const u = ent.userData;
  particles.debris(ent.position);
  particles.sparkles(ent.position);
  particles.sparkles(ent.position.clone().add(new THREE.Vector3(0, 3, 0)));
  audio.crumble && audio.crumble();
  shake = Math.max(shake, 0.9);
  haptics.huge();
  score += u.score || 100;
  addAtomicCharge(u.atomicCharge || 15);
  addGrowth(u.nutrition || 8);
  runStats.kaijuDowned = (runStats.kaijuDowned || 0) + 1;
  updateObjectiveProgress();
  checkObjectiveComplete();
  kaiju.remove(ent);
  // Respawn the same kind after a longer delay than other enemies
  const kaijuType = u.kaijuType;
  setTimeout(() => {
    if (!gameRunning || !kaiju) return;
    const counts = { mecha: 0, crab: 0, moth: 0, scorpion: 0 };
    counts[kaijuType] = 1;
    const refresh = spawnKaiju(scene, player.position, counts);
    while (refresh.children.length) kaiju.add(refresh.children[0]);
    scene.remove(refresh);
  }, 14000 + Math.random() * 6000);
}

// Eat a level-specific landmark. Reactor cores instantly fill the
// Atomic Charge meter; everything else is a "building" that
// recordEvent('buildingsToppled') counts toward the topple objectives.
function downLandmark(obj) {
  if (!landmarks) return;
  const u = obj.userData;
  if (u.falling) return; // already toppling, don't double-count
  particles.debris(obj.position);
  particles.sparkles(obj.position);
  audio.crumble && audio.crumble();
  shake = Math.max(shake, 0.5);
  haptics.huge();
  if (u.kind === 'reactor') {
    // Special: drink the reactor, charge bar fills instantly
    if (player && player.userData.species === 'titan') {
      player.userData.atomicCharge = ATOMIC_CHARGE_MAX;
      player.userData.atomicChargeFullJustNow = true;
      audio.atomicFull && audio.atomicFull();
      updateAtomicHUD();
    }
    score += u.score || 80;
    addGrowth(8);
    runStats.reactorsEaten = (runStats.reactorsEaten || 0) + 1;
    updateObjectiveProgress();
    checkObjectiveComplete();
    landmarks.remove(obj);
  } else {
    score += u.score || 50;
    addGrowth(3);
    if (u.subtype === 'oilRig') {
      runStats.oilRigsToppled = (runStats.oilRigsToppled || 0) + 1;
    }
    recordEvent('buildingsToppled');
    // Use the same topple animation as regular city buildings — the
    // animateBuildings tick is already pumping the landmarks group.
    topple(obj, player.position.x, player.position.z);
  }
}

function downGroundEnemy(ent) {
  if (!groundMilitary) return;
  const u = ent.userData;
  particles.debris(ent.position);
  particles.dust(ent.position);
  if (u.groundType === 'silo' || u.groundType === 'tank') {
    audio.crumble && audio.crumble();
    shake = Math.max(shake, 0.4);
  }
  score += u.score || 10;
  addAtomicCharge(u.atomicCharge || 5);
  addGrowth(u.nutrition || 2);
  runStats.groundDestroyed = (runStats.groundDestroyed || 0) + 1;
  if (u.groundType === 'tank') {
    runStats.tanksDestroyed = (runStats.tanksDestroyed || 0) + 1;
  }
  updateObjectiveProgress();
  checkObjectiveComplete();
  groundMilitary.remove(ent);
  // Respawn the same kind after a delay
  const groundType = u.groundType;
  setTimeout(() => {
    if (!gameRunning || !groundMilitary) return;
    const counts = { tank: 0, silo: 0, soldier: 0 };
    counts[groundType] = 1;
    const refresh = spawnGroundMilitary(scene, player.position, counts);
    while (refresh.children.length) groundMilitary.add(refresh.children[0]);
    scene.remove(refresh);
  }, 7000 + Math.random() * 4000);
}

function downAirEnemy(ent, fromBeam = false) {
  if (!airEnemies) return;
  const u = ent.userData;
  particles.debris(ent.position);
  particles.sparkles(ent.position);
  audio.crumble && audio.crumble();
  shake = Math.max(shake, fromBeam ? 0.4 : 0.25);
  score += u.score || 10;
  addAtomicCharge(u.atomicCharge || 5);
  addGrowth(u.nutrition || 2);
  airEnemies.remove(ent);
  // Respawn the same kind after a delay so the sky stays lively
  const airType = u.airType;
  setTimeout(() => {
    if (!gameRunning || !airEnemies) return;
    const counts = { heli: 0, jet: 0, drone: 0 };
    counts[airType === 'heli' ? 'heli' : airType === 'jet' ? 'jet' : 'drone'] = 1;
    const refresh = spawnAirEnemies(scene, player.position, counts);
    // Move children into the live group rather than keeping a second one
    while (refresh.children.length) airEnemies.add(refresh.children[0]);
    scene.remove(refresh);
  }, 6000 + Math.random() * 3000);
}

// Per-level air-enemy budget. Tuned so City Rampage and the Megacity-
// style levels feel hostile while quieter biomes only get one helicopter
// in the distance.
function getAirEnemyCounts(levelKey) {
  switch (levelKey) {
    case 'cityRampage':
    case 'nightCity':
      return { heli: 2, jet: 1, drone: 3 };
    case 'megacity':
      return { heli: 2, jet: 2, drone: 6 };
    case 'harbor':
      return { heli: 2, jet: 1, drone: 1 };
    case 'military':
      return { heli: 3, jet: 2, drone: 2 };
    case 'highway':
      return { heli: 1, jet: 3, drone: 0 };
    case 'powerPlant':
      return { heli: 2, jet: 1, drone: 2 };
    case 'lavaThrone':
      return { heli: 0, jet: 0, drone: 0 };
    case 'dinoPark':
      return { heli: 1, jet: 0, drone: 0 };
    case 'volcano':
      return { heli: 1, jet: 1, drone: 0 };
    case 'tundra':
    case 'lostWorld':
    case 'night':
      return { heli: 1, jet: 0, drone: 0 };
    default:
      return { heli: 1, jet: 0, drone: 0 };
  }
}

// Per-level kaiju budget. Most kaiju appear sparingly (1-2 in their
// natural biome). Mecha Titan is the Power Plant marquee; Scorpion is
// the Lava Throne resident; Crab is harbor flavor; Moth haunts night.
function getKaijuCounts(levelKey) {
  switch (levelKey) {
    case 'powerPlant':  return { mecha: 1, crab: 0, moth: 0, scorpion: 0 };
    case 'lavaThrone':  return { mecha: 0, crab: 0, moth: 0, scorpion: 2 };
    case 'harbor':      return { mecha: 0, crab: 2, moth: 0, scorpion: 0 };
    case 'night':       return { mecha: 0, crab: 0, moth: 1, scorpion: 0 };
    case 'nightCity':   return { mecha: 0, crab: 0, moth: 1, scorpion: 0 };
    case 'megacity':    return { mecha: 1, crab: 0, moth: 0, scorpion: 0 };
    case 'volcano':     return { mecha: 0, crab: 0, moth: 0, scorpion: 1 };
    default:            return { mecha: 0, crab: 0, moth: 0, scorpion: 0 };
  }
}

// Per-level ground-military budget. Military Base is the marquee; other
// levels get a sprinkling for flavor.
function getGroundMilitaryCounts(levelKey) {
  switch (levelKey) {
    case 'military':
      return { tank: 4, silo: 3, soldier: 6 };
    case 'cityRampage':
    case 'nightCity':
      return { tank: 2, silo: 1, soldier: 3 };
    case 'megacity':
      return { tank: 2, silo: 2, soldier: 4 };
    case 'harbor':
      return { tank: 1, silo: 1, soldier: 2 };
    case 'highway':
      return { tank: 3, silo: 0, soldier: 2 };
    case 'powerPlant':
      return { tank: 1, silo: 2, soldier: 3 };
    default:
      return { tank: 0, silo: 0, soldier: 0 };
  }
}

// ---------------- Stats / Achievements / Objectives ----------------

// How much Atomic Charge each kind of event awards Titan. Anything not
// in here grants nothing — food/plants/etc. are growth-only, not charge.
const ATOMIC_CHARGE_BY_KIND = {
  buildingsToppled: 8,
  vehiclesChomped:  6,
  dinosEaten:       6,
  crittersEaten:    1,
};
const ATOMIC_CHARGE_MAX = 100;

function addAtomicCharge(amount) {
  if (!player || player.userData.species !== 'titan') return;
  const before = player.userData.atomicCharge || 0;
  const after = Math.min(ATOMIC_CHARGE_MAX, before + amount);
  player.userData.atomicCharge = after;
  // Fire a one-time "meter just filled" event so A3 (Mega Beam) and A2
  // (HUD pulse) can hook in later without touching this function.
  if (before < ATOMIC_CHARGE_MAX && after >= ATOMIC_CHARGE_MAX) {
    player.userData.atomicChargeFullJustNow = true;
    audio.atomicFull && audio.atomicFull();
  }
  updateAtomicHUD();
}

function recordEvent(kind, n = 1) {
  if (!runStats) return;
  runStats[kind] = (runStats[kind] || 0) + n;
  save.incStat(kind, n);
  const chargePer = ATOMIC_CHARGE_BY_KIND[kind];
  if (chargePer) addAtomicCharge(chargePer * n);
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
    case 'reactorsEaten':  return runStats.reactorsEaten || 0;
    case 'kaijuDowned':    return runStats.kaijuDowned || 0;
    case 'destroyGround':  return runStats.tanksDestroyed || 0;
    case 'oilRigsToppled': return runStats.oilRigsToppled || 0;
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
  if (optDayNightCb)   optDayNightCb.checked   = !!s.options.dayNight;
  if (s.lastLevel && LEVELS[s.lastLevel]) selectedLevelKey = s.lastLevel;
  buildLevelPicker();
  refreshUnlockStates();
}

// Lock toggles that are gated behind completing specific levels.
function refreshUnlockStates() {
  for (const label of document.querySelectorAll('#settings .toggle')) {
    const mode = label.dataset.mode;
    if (!mode) continue;
    const cb = label.querySelector('input[type=checkbox]');
    const locked = !save.isModeUnlocked(mode);
    label.classList.toggle('locked', locked);
    if (locked) {
      cb.checked = false;
      cb.disabled = true;
      let hint = label.querySelector('.lock-hint');
      if (!hint) {
        hint = document.createElement('span');
        hint.className = 'lock-hint';
        label.appendChild(hint);
      }
      const u = save.MODE_UNLOCKS[mode];
      hint.textContent = u ? `Beat ${u.label} to unlock` : '';
    } else {
      cb.disabled = false;
    }
  }
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
  // Flatten the cone test to the horizontal plane. The Titan's mouth sits
  // high above the ground, so a strict 3D cone misses close enemies that
  // are below the mouth — even though the beam visibly sweeps over them.
  const fwdLen = Math.hypot(fwd.x, fwd.z) || 1;
  const fwdHx = fwd.x / fwdLen;
  const fwdHz = fwd.z / fwdLen;
  // Anything within this radius gets vaporized regardless of cone angle,
  // so a Titan with an enemy right at its feet can still chomp it with
  // the beam button.
  const SPLASH_RADIUS = 5;
  const eat = (group, handler) => {
    if (!group) return;
    for (let i = group.children.length - 1; i >= 0; i--) {
      const obj = group.children[i];
      const dx = obj.position.x - origin.x;
      const dz = obj.position.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      // Close-range splash: always hit
      if (dist < SPLASH_RADIUS) { handler(obj); continue; }
      // Horizontal cone check
      const dot = (dx / dist) * fwdHx + (dz / dist) * fwdHz;
      if (dot < coneCos) continue;
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

  // Air enemies — Plasma Breath / Sweep / Mega all melt them
  eat(airEnemies, (a) => downAirEnemy(a, true));
  // Ground military — same fate as anything else in the beam path
  eat(groundMilitary, (g) => downGroundEnemy(g));
  // Kaiju — Mecha shield deflects beams too
  eat(kaiju, (k) => { if (!kaijuBlocksAOE(k)) downKaiju(k); });
  // Landmarks fall the same way as buildings — skip ambient atmosphere
  // and flat decoration (water/lava/runway/road).
  eat(landmarks, (lm) => {
    const k = lm.userData.kind;
    if (k === 'water' || k === 'lava' || k === 'runway' || k === 'road') return;
    downLandmark(lm);
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
  // Plasma Breath deals heavy damage to a boss caught in the cone
  if (boss && !boss.userData.dying) {
    // Same flat horizontal cone test + close-range splash so the beam
    // can hit a boss right at the Titan's feet.
    const dx = boss.position.x - origin.x;
    const dz = boss.position.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d <= range) {
      const inSplash = d < SPLASH_RADIUS;
      const dot = d > 0.001 ? (dx / d) * fwdHx + (dz / d) * fwdHz : 1;
      if (inSplash || dot >= coneCos) {
        const reward = damageBoss(boss, 8);
        if (reward > 0) { score += reward; onBossDefeated(); }
        else { score += 16; particles.meat(boss.position); shake = Math.max(shake, 0.3); }
      }
    }
  }
}

function firePlasmaBreath() {
  audio.plasmaBreath();
  plateFlash = 0.6;
  setTimeout(() => {
    if (!gameRunning || !player || player.userData.species !== 'titan') return;
    const yaw = player.rotation.y - (player.userData.faceFlip || 0);
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

// ---- New Titan moves (A3, B1, B2, B3, B5) ----

// A3. Mega Beam — held action button + full charge. Drains the entire
// meter, fires a fat plasma beam at 3× range that levels everything it
// touches and scorches the boss for big damage.
function fireMegaBeam() {
  if (!player || player.userData.species !== 'titan') return;
  if ((player.userData.atomicCharge || 0) < ATOMIC_CHARGE_MAX) return;
  player.userData.atomicCharge = 0;
  player.userData.atomicChargeFullJustNow = false;
  updateAtomicHUD();
  audio.megaBeam();
  plateFlash = 1.4;
  haptics.huge();
  shake = Math.max(shake, 1.0);
  titanBeamMode = 'mega';
  megaBeamLife = 0.85;
  const yaw = player.rotation.y - (player.userData.faceFlip || 0);
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const scale = player.scale.x;
  const mouth = player.position.clone();
  mouth.y += 2.4 * scale;
  mouth.add(fwd.clone().multiplyScalar(scale));
  // Triple-radius beam visual — reuse spawnBeam with a giant scale arg.
  spawnBeam(mouth, fwd, scale * 3.0);
  beamLife = 0.85; // matches megaBeamLife so the fade looks right
  const range = (20 + scale * 6) * 3;
  // Wide cone that catches even off-axis enemies
  consumeInCone(mouth, fwd, range, Math.cos(0.8));
  particles.sparkles(mouth);
}

// B1. Plasma Pulse — double-tap action button, costs 25 charge. 360°
// radial plasma burst centered on Titan.
function firePlasmaPulse() {
  if (!player || player.userData.species !== 'titan') return;
  if ((player.userData.atomicCharge || 0) < PLASMA_PULSE_COST) return;
  player.userData.atomicCharge -= PLASMA_PULSE_COST;
  updateAtomicHUD();
  audio.plasmaPulse();
  plateFlash = Math.max(plateFlash, 0.5);
  particles.sparkles(player.position.clone().add(new THREE.Vector3(0, 2.4 * player.scale.x, 0)));
  shake = Math.max(shake, 0.5);
  haptics.huge();
  const r = 16 + player.scale.x * 2.5;
  consumeAround(player.position, r);
  // Damage boss if in range — pulse is generous
  if (boss && !boss.userData.dying) {
    const d = boss.position.distanceTo(player.position);
    if (d <= r) {
      const reward = damageBoss(boss, 4);
      if (reward > 0) { score += reward; onBossDefeated(); }
      else { score += 8; particles.meat(boss.position); }
    }
  }
}

// B2. Stomp Quake — CHOMP + ACTION chord. Titan leaps up, slams down,
// ring shockwave knocks down everything in a wide radius on impact.
function fireStompQuake() {
  if (quakeCooldown > 0 || quakeTimer > 0) return;
  audio.stompQuake();
  quakeTimer = QUAKE_DURATION;
  quakeApex = 4 + player.scale.x * 2.0;
  quakeCooldown = QUAKE_COOLDOWN;
  haptics.huge();
}

function tickQuake(dt) {
  if (quakeTimer <= 0) return;
  const before = quakeTimer;
  quakeTimer = Math.max(0, quakeTimer - dt);
  const elapsed = QUAKE_DURATION - quakeTimer;
  const phaseRise = 0.32;
  const phaseHold = 0.48;
  let yOffset;
  if (elapsed < phaseRise) {
    const t = elapsed / phaseRise;
    yOffset = Math.sin(t * Math.PI * 0.5) * quakeApex;
  } else if (elapsed < phaseHold) {
    yOffset = quakeApex;
  } else {
    const t = (elapsed - phaseHold) / (QUAKE_DURATION - phaseHold);
    yOffset = (1 - t) * quakeApex;
  }
  player.position.y = getHeightAt(player.position.x, player.position.z) + yOffset;
  // Impact moment — when phase 3 just finished
  if (before > 0 && quakeTimer === 0) {
    shake = Math.max(shake, 1.2);
    haptics.huge();
    particles.dust(player.position);
    particles.dust(player.position);
    const r = 20 + player.scale.x * 3;
    consumeAround(player.position, r);
    // Boss takes contact damage from the slam
    if (boss && !boss.userData.dying) {
      const d = boss.position.distanceTo(player.position);
      if (d <= r) {
        const reward = damageBoss(boss, 3);
        if (reward > 0) { score += reward; onBossDefeated(); }
      }
    }
  }
}

// B3. Tail Sweep — pressing ACTION while moving backward. Rear cone AOE
// that levels a row of buildings behind Titan.
function fireTailSweep() {
  audio.tailSweep();
  particles.dust(player.position);
  shake = Math.max(shake, 0.4);
  haptics.big();
  const yaw = player.rotation.y - (player.userData.faceFlip || 0);
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const scale = player.scale.x;
  const origin = player.position.clone()
    .add(back.clone().multiplyScalar(scale * 1.2));
  origin.y += 1.0 * scale;
  consumeInCone(origin, back, 14 + scale * 3, Math.cos(0.75));
}

// B5. Beam Sweep — sustained beam that tracks Titan's rotation while
// the action button is held. Drains charge while active.
function tickBeamSweep(dt) {
  if (titanBeamMode !== 'sweep') return;
  const yaw = player.rotation.y - (player.userData.faceFlip || 0);
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const scale = player.scale.x;
  const mouth = player.position.clone();
  mouth.y += 2.4 * scale;
  mouth.add(fwd.clone().multiplyScalar(scale));
  // Redraw the beam each frame so it tracks the player.
  spawnBeam(mouth, fwd, scale * 0.8);
  beamLife = 0.12; // very short — re-spawned each frame
  // Periodically vaporize what's in the cone
  titanSweepTickCd -= dt;
  if (titanSweepTickCd <= 0) {
    titanSweepTickCd = 0.22;
    const range = 15 + scale * 4;
    consumeInCone(mouth, fwd, range, Math.cos(0.4));
    // Drain charge per tick
    player.userData.atomicCharge = Math.max(0, (player.userData.atomicCharge || 0) - 4);
    updateAtomicHUD();
  }
}

function endBeamSweep() {
  if (titanBeamMode === 'sweep') {
    titanBeamMode = null;
    clearBeam();
  }
}

function tickMegaBeam(dt) {
  if (titanBeamMode !== 'mega') return;
  megaBeamLife -= dt;
  if (megaBeamLife <= 0) {
    titanBeamMode = null;
    clearBeam();
  }
}

// Titan's input fork. Distinguished from updateAbility because Titan has
// a totally different scheme: tap fires Plasma Breath (or Tail Sweep
// when moving backward), double-tap also fires Plasma Pulse, hold begins
// Beam Sweep, hold+full-charge unleashes the Mega Beam, chomp+action
// chord triggers Stomp Quake.
function updateTitanAbility(dt) {
  // Mid-Quake: lock out input so the leap-slam plays out cleanly
  if (quakeTimer > 0) return;

  const blast = controls.blastPressed;
  const blastHeld = controls.blastHeld;
  const blastHoldTime = controls.blastHoldTime;
  const blastDoubleTap = controls.blastDoubleTap;
  const chompPressed = controls.chompPressed;
  const movingBackward = controls.move.y > 0.4;

  // 1. Chord: chomp + blast same frame → Stomp Quake. Wins over Plasma.
  if (blast && chompPressed) {
    fireStompQuake();
    beamSweepArmed = false;
    return;
  }

  // 2. Single-tap: Plasma Breath (forward) or Tail Sweep (rear). Hold
  //    state is what unlocks Beam/Mega, so don't gate the initial tap.
  if (blast) {
    if (movingBackward) fireTailSweep();
    else                firePlasmaBreath();
  }

  // 3. Double-tap on the second press also fires Plasma Pulse (charge gated)
  if (blastDoubleTap) firePlasmaPulse();

  // 4. Hold-to-charge: arm Beam Sweep after 0.42s of holding. Switch to
  //    Mega Beam if the meter is full at the 1.0s mark.
  if (blastHeld && !beamSweepArmed) {
    if (blastHoldTime >= MEGA_BEAM_HOLD_THRESHOLD &&
        (player.userData.atomicCharge || 0) >= ATOMIC_CHARGE_MAX) {
      fireMegaBeam();
      beamSweepArmed = true; // suppress sweep auto-arm
    } else if (blastHoldTime >= BEAM_SWEEP_HOLD_THRESHOLD &&
               (player.userData.atomicCharge || 0) > 0 &&
               titanBeamMode === null) {
      titanBeamMode = 'sweep';
      titanSweepTickCd = 0;
      beamSweepArmed = true;
    }
  }
  if (!blastHeld) beamSweepArmed = false;

  // 5. Tick active beam modes
  if (titanBeamMode === 'sweep') {
    if (!blastHeld || (player.userData.atomicCharge || 0) <= 0) endBeamSweep();
    else tickBeamSweep(dt);
  } else if (titanBeamMode === 'mega') {
    tickMegaBeam(dt);
  }
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
  // Leap forward in current facing direction. Subtract faceFlip so
  // FBX-rigged Velociraptor pounces in the visual-forward direction
  // rather than the wrapper-rotation-forward direction (which is +PI
  // off because of the +Z-vs--Z convention flip).
  const yaw = player.rotation.y - (player.userData.faceFlip || 0);
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

// Ankylosaurus tail-club: radial knockback + stun. Tighter radius than
// Stomp (12u vs 16u), but flings enemies outward and topples buildings.
function fireSmash() {
  audio.abilitySmash();
  particles.dust(player.position);
  shake = Math.max(shake, 0.5);
  haptics.huge();
  const here = player.position;
  const r = 12 + player.scale.x * 1.5;
  const r2 = r * r;
  if (entities) {
    for (const ent of entities.children) {
      if (ent.userData.kind !== 'enemy' && ent.userData.kind !== 'critter') continue;
      const dx = ent.position.x - here.x;
      const dz = ent.position.z - here.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      ent.userData.stunTimer = 2.5;
    }
  }
  // Topple any buildings in range — same path Sweep uses
  consumeAround(here, r * 0.75);
}

// Parasaurolophus trumpet: very long-range flee aura. Bigger than Roar.
function fireCall() {
  audio.abilityCall();
  particles.sparkles(player.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
  shake = Math.max(shake, 0.2);
  haptics.big();
  if (!entities) return;
  const range = 35;
  for (const ent of entities.children) {
    if (ent.userData.kind !== 'enemy' && ent.userData.kind !== 'critter') continue;
    const d = ent.position.distanceTo(player.position);
    if (d < range) ent.userData.fleeTimer = 4.0;
  }
}

// Pteranodon swoop: forward glide-leap that auto-eats anything along
// the flight path. Like Pounce, but flies further and clears a tube
// rather than a single landing point.
function fireSwoop() {
  audio.abilitySwoop();
  haptics.big();
  const yaw = player.rotation.y - (player.userData.faceFlip || 0);
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  pounceStart.copy(player.position);
  pounceEnd.copy(player.position).add(fwd.multiplyScalar(18));
  pounceTimer = 0.55;
  // Consume along the path as a series of small ranges so anything
  // standing in the corridor gets eaten on the way through.
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const p = pounceStart.clone().lerp(pounceEnd, i / steps);
    consumeAround(p, 3.0);
  }
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
  else if (kind === 'smash')    fireSmash();
  else if (kind === 'call')     fireCall();
  else if (kind === 'swoop')    fireSwoop();
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
  // Air enemies — Plasma Pulse / Stomp Quake / Sweep all reach them
  check(airEnemies, (a) => downAirEnemy(a));
  // Ground military — tanks, silos, soldiers fall to the same AOE
  check(groundMilitary, (g) => downGroundEnemy(g));
  // Kaiju — Mecha shield blocks AOE; others fall like anything else
  check(kaiju, (k) => { if (!kaijuBlocksAOE(k)) downKaiju(k); });
  // Landmarks (oil rigs, radar dishes, cooling towers, reactors) — but
  // skip ambient atmosphere (water/lava) and flat decoration (runway/road).
  check(landmarks, (lm) => {
    const k = lm.userData.kind;
    if (k === 'water' || k === 'lava' || k === 'runway' || k === 'road') return;
    downLandmark(lm);
  });
  // Plants — critical for herbivore Sweep/Smash to feel responsive
  check(plants, (p) => {
    particles.leaves(p.position);
    plants.remove(p);
    addGrowth(p.userData.nutrition || 1);
    score += 1;
    recordEvent('plantsEaten');
    spawnPlantRandom(plants);
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
  // Bosses take AOE damage (4 hp) — they're the only enemy this large
  if (boss && !boss.userData.dying) {
    const dx = boss.position.x - origin.x;
    const dz = boss.position.z - origin.z;
    if (dx * dx + dz * dz <= range * range) {
      const reward = damageBoss(boss, 4);
      if (reward > 0) { score += reward; onBossDefeated(); }
      else { score += 8; particles.meat(boss.position); }
    }
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
  if (quakeCooldown > 0) quakeCooldown = Math.max(0, quakeCooldown - dt);

  // Titan has a separate chord-rich input scheme; other species fire
  // their single ability on tap.
  if (player && player.userData.species === 'titan') {
    updateTitanAbility(dt);
  } else if (activeAbility && controls.blastPressed && abilityCooldown <= 0) {
    fireAbility(activeAbility.kind);
  }

  // Stomp Quake leap-slam motion (any Titan can use this — see chord above)
  tickQuake(dt);

  if (plateFlash > 0) plateFlash = Math.max(0, plateFlash - dt);
  // Titan dorsal plates: emissive intensity scales with current Atomic
  // Charge so you can SEE the meter charging up on the dino itself. The
  // existing plateFlash burst stacks on top while firing.
  if (player && player.userData.species === 'titan') {
    const plates = player.userData.parts && player.userData.parts.plates;
    if (plates && plates[0]) {
      const charge = Math.min(1, (player.userData.atomicCharge || 0) / 100);
      let glow = 0.9 + charge * 2.2 + plateFlash * 5;
      // Full-meter shimmer: gentle 1.5Hz pulse so you can't miss it
      if (charge >= 1) glow += 0.6 + Math.sin(performance.now() * 0.009) * 0.6;
      plates[0].material.emissiveIntensity = glow;
    }
  }

  // Fade out the regular plasma beam. Sweep/Mega manage their own beam
  // lifetime (sweep re-spawns every frame, mega lives a fixed time).
  if (beamMesh && titanBeamMode === null) {
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
    // For FBX wrappers the rotation includes the +PI face flip, which
    // makes the standard (-sin, -cos) yaw-to-forward formula point
    // BACKWARD. Subtract the flip so charge always pushes the dino in
    // the direction it's actually facing.
    const yaw = player.rotation.y - (player.userData.faceFlip || 0);
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
      const targetYaw = Math.atan2(-mv.x, -mv.y) + (player.userData.faceFlip || 0);
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
    if (player.userData.mixer) triggerAttack(player);
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
  const apexMode = power.active === 'apex' || gameSettings.invincible || frenzyTimer > 0;

  for (const ent of entities.children) {
    const d = ent.userData;

    // Update the at-feet predator/prey indicator before any early-return.
    // Green = safe to eat. Red = it will eat you. Apex modes paint
    // everything green since nothing can hurt you.
    if (d.dangerRingMat && d.kind === 'enemy') {
      const safe = apexMode || playerScale >= d.scale * 0.95;
      d.dangerRingMat.color.setHex(safe ? 0x2aff3a : 0xff3a3a);
      d.dangerRingMat.opacity = 0.55 + Math.sin(performance.now() * 0.006) * 0.18;
    }

    // Stun (Stomp ability): freeze in place while the timer runs
    if (d.stunTimer > 0) {
      d.stunTimer -= dt;
      d.motionNorm = 0;
      animateDino(ent, dt, false);
      continue;
    }
    // Forced flee (Roar ability): override behavior and run from player
    if (d.fleeTimer > 0) {
      d.fleeTimer -= dt;
      d.motionNorm = 1.0;
      const ax = ent.position.x - player.position.x;
      const az = ent.position.z - player.position.z;
      const al = Math.hypot(ax, az) || 1;
      const sp = (d.speed || 3) * 1.6;
      ent.position.x += (ax / al) * sp * dt;
      ent.position.z += (az / al) * sp * dt;
      ent.rotation.y = Math.atan2(-(ax / al), -(az / al)) + (ent.userData.faceFlip || 0);
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
      ent.rotation.y = Math.atan2(-d.wanderDir.x, -d.wanderDir.z) + (ent.userData.faceFlip || 0);
      d.motionNorm = d.fleeing ? 0.9 : 0.35;
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
        d.motionNorm = 1.0;
      } else if (playerBigger && distToPlayer < 18) {
        dir.copy(ent.position).sub(player.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.001) dir.normalize();
        ent.position.x += dir.x * d.speed * 1.2 * dt;
        ent.position.z += dir.z * d.speed * 1.2 * dt;
        moving = true;
        d.motionNorm = 1.0;
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
        d.motionNorm = moving ? 0.35 : 0;
      }

      if (moving) {
        const targetYaw = Math.atan2(-dir.x, -dir.z) + (ent.userData.faceFlip || 0);
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

  // Reactor cores — walk into one as Titan, the meter fills instantly.
  // Other landmarks are topple-only (handled by AOE/beams).
  if (landmarks) {
    for (let i = landmarks.children.length - 1; i >= 0; i--) {
      const lm = landmarks.children[i];
      if (lm.userData.kind !== 'reactor') continue;
      const d = lm.position.distanceTo(player.position);
      if (d < (playerSize + lm.userData.size) * 0.7 * reachBoost) {
        downLandmark(lm);
      }
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
