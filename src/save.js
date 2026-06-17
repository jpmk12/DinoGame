// localStorage-backed save system: best scores per level, completed levels,
// achievements, lifetime stats. All other features read/write through here.

const KEY = 'dinogrow_save_v1';

const DEFAULT = {
  bestScores: {},      // levelKey -> highest score achieved
  completed: {},       // levelKey -> true once the level's objective was met
  achievements: [],    // array of achievement keys earned
  stats: {
    plantsEaten: 0,
    crittersEaten: 0,
    dinosEaten: 0,
    foodsEaten: 0,
    babiesHatched: 0,
    buildingsToppled: 0,
    vehiclesChomped: 0,
    plasmaUses: 0,
    abilityUses: 0,
    watermelonsEaten: 0,
    factsSeen: 0,
    timesPlayed: 0,
    bossesDefeated: 0,
    levelsPlayed: {},
    speciesPlayed: {},
  },
  options: {
    startGiant: false,
    invincible: false,
    speedDemon: false,
    megaFood: false,
    mega: false,
  },
  lastSpecies: 'trex',
  lastLevel: 'lostWorld',
  tutorialDone: false,
};

let cache = null;
let dirty = false;
let flushTimer = null;

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function merge(template, data) {
  const out = deepClone(template);
  if (!data || typeof data !== 'object') return out;
  for (const k of Object.keys(template)) {
    if (data[k] === undefined) continue;
    if (template[k] && typeof template[k] === 'object' && !Array.isArray(template[k])) {
      out[k] = merge(template[k], data[k]);
    } else {
      out[k] = data[k];
    }
  }
  // Preserve unknown maps the user might have (forward-compat)
  for (const k of Object.keys(data)) {
    if (out[k] === undefined) out[k] = data[k];
  }
  return out;
}

export function loadSave() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? merge(DEFAULT, JSON.parse(raw)) : deepClone(DEFAULT);
  } catch (e) {
    cache = deepClone(DEFAULT);
  }
  return cache;
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  // Coalesce writes — at most one localStorage hit every 800ms.
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!dirty) return;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
    dirty = false;
  }, 800);
}

export function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
  dirty = false;
}

export function incStat(key, by = 1) {
  const s = loadSave();
  s.stats[key] = (s.stats[key] || 0) + by;
  scheduleFlush();
  return s.stats[key];
}

export function incMapStat(mapKey, subKey, by = 1) {
  const s = loadSave();
  const m = s.stats[mapKey] = s.stats[mapKey] || {};
  m[subKey] = (m[subKey] || 0) + by;
  scheduleFlush();
  return m[subKey];
}

export function recordBestScore(levelKey, score) {
  const s = loadSave();
  const prev = s.bestScores[levelKey] || 0;
  if (score > prev) {
    s.bestScores[levelKey] = score;
    scheduleFlush();
    return true;
  }
  return false;
}

export function markCompleted(levelKey) {
  const s = loadSave();
  if (s.completed[levelKey]) return false;
  s.completed[levelKey] = true;
  scheduleFlush();
  return true;
}

export function saveOptions(opts) {
  const s = loadSave();
  s.options = { ...s.options, ...opts };
  scheduleFlush();
}

export function saveLastPlayed(species, level) {
  const s = loadSave();
  s.lastSpecies = species;
  s.lastLevel = level;
  scheduleFlush();
}

export function tutorialDone() { return !!loadSave().tutorialDone; }
export function setTutorialDone() {
  const s = loadSave();
  s.tutorialDone = true;
  scheduleFlush();
}

// ---------------- Achievements ----------------
// Modes unlocked by beating specific levels. If the gating level isn't
// completed yet, the toggle is shown disabled with a "Beat X to unlock" hint.
export const MODE_UNLOCKS = {
  speedDemon: { level: 'lostWorld',   label: 'Lost World' },
  megaFood:   { level: 'volcano',     label: 'Volcano Lands' },
  invincible: { level: 'tundra',      label: 'Frozen Tundra' },
  startGiant: { level: 'dinoPark',    label: 'Dino Park' },
  mega:       { level: 'cityRampage', label: 'City Rampage' },
  // dayNight unlocks after completing Night Forest
  dayNight:   { level: 'night',       label: 'Night Forest' },
};

export function isModeUnlocked(modeKey) {
  const u = MODE_UNLOCKS[modeKey];
  if (!u) return true;
  return !!loadSave().completed[u.level];
}

export const ACHIEVEMENTS = {
  firstBite:     { name: 'First Bite',       desc: 'Eat your first plant',        icon: '🌱' },
  herbivore:     { name: 'Herbivore',        desc: 'Eat 50 plants',               icon: '🌿' },
  carnivore:     { name: 'Carnivore',        desc: 'Eat 10 dinos',                icon: '🥩' },
  apex:          { name: 'Apex Predator',    desc: 'Reach the GIANT stage',        icon: '🦖' },
  blockSmasher:  { name: 'Block Smasher',    desc: 'Topple 10 buildings',         icon: '🧱' },
  cityRuined:    { name: 'City Demolisher',  desc: 'Topple 50 buildings',         icon: '🏚️' },
  rangerHunt:    { name: 'Ranger Hunt',      desc: 'Chomp 5 ranger jeeps',        icon: '🚙' },
  parent:        { name: 'Proud Parent',     desc: 'Hatch 5 baby dinos',          icon: '🐣' },
  worldTour:     { name: 'World Tour',       desc: 'Play every level at least once', icon: '🗺️' },
  factFan:       { name: 'Fact Fan',         desc: 'See 10 dinosaur facts',       icon: '📚' },
  plasmaMaster:  { name: 'Plasma Master',    desc: 'Use Plasma Breath 10 times',  icon: '⚡' },
  juicy:         { name: 'Juicy',            desc: 'Eat a watermelon',            icon: '🍉' },
  speciesist:    { name: 'Variety',          desc: 'Play 4 different dino species', icon: '🦕' },
  bossSlayer:    { name: 'Boss Slayer',      desc: 'Defeat your first boss',      icon: '👹' },
  masterHunter:  { name: 'Master Hunter',    desc: 'Defeat 5 bosses',             icon: '🏹' },
};

const _newUnlockQueue = [];

export function unlockAchievement(key) {
  if (!ACHIEVEMENTS[key]) return false;
  const s = loadSave();
  if (s.achievements.includes(key)) return false;
  s.achievements.push(key);
  scheduleFlush();
  _newUnlockQueue.push(key);
  return true;
}

export function popNewAchievement() {
  return _newUnlockQueue.shift() || null;
}

export function hasAchievement(key) {
  return loadSave().achievements.includes(key);
}

// Centralized check after stat changes — call after any incStat that might
// qualify for an achievement, and from key game events.
export function checkAchievements({ playedLevelKey, playedSpecies, currentStage } = {}) {
  const s = loadSave();
  const st = s.stats;
  if (st.plantsEaten >= 1)       unlockAchievement('firstBite');
  if (st.plantsEaten >= 50)      unlockAchievement('herbivore');
  if (st.dinosEaten >= 10)       unlockAchievement('carnivore');
  if (currentStage >= 4)         unlockAchievement('apex');
  if (st.buildingsToppled >= 10) unlockAchievement('blockSmasher');
  if (st.buildingsToppled >= 50) unlockAchievement('cityRuined');
  if (st.vehiclesChomped >= 5)   unlockAchievement('rangerHunt');
  if (st.babiesHatched >= 5)     unlockAchievement('parent');
  if (st.factsSeen >= 10)        unlockAchievement('factFan');
  if (st.plasmaUses >= 10)       unlockAchievement('plasmaMaster');
  if (st.watermelonsEaten >= 1)  unlockAchievement('juicy');
  if (st.bossesDefeated >= 1)    unlockAchievement('bossSlayer');
  if (st.bossesDefeated >= 5)    unlockAchievement('masterHunter');
  const lvls = Object.keys(st.levelsPlayed || {}).length;
  if (lvls >= 6)                 unlockAchievement('worldTour');
  const sp = Object.keys(st.speciesPlayed || {}).length;
  if (sp >= 4)                   unlockAchievement('speciesist');
}
