import * as THREE from 'three';
import { buildCritter, SPECIES, ALL_SPECIES } from './dinos.js';
import { createDinoMeshSync } from './modelLoader.js';
import { WORLD_SIZE, getHeightAt } from './world.js';

// Growth stages: index 0..4. Each stage has a base scale.
export const STAGE_NAMES = [
  'Hatchling',
  'Juvenile',
  'Sub-adult',
  'Adult',
  'GIANT',
];
export const STAGE_SCALE = [0.35, 0.6, 0.9, 1.3, 1.9];
// Growth points needed to *enter* this stage. Stage 0 is start.
export const STAGE_THRESHOLD = [0, 6, 18, 40, 80];
// Max growth in last stage (acts as visual cap for the bar)
export const MAX_GROWTH = 130;

export function buildPlayer(speciesKey) {
  const spec = SPECIES[speciesKey] || SPECIES.trex;
  const dino = createDinoMeshSync(speciesKey);
  dino.userData.species = speciesKey;
  dino.userData.kind = 'player';
  dino.userData.growth = 0;
  dino.userData.stage = 0;
  dino.userData.walkPhase = 0;
  dino.userData.chompTimer = 0;
  dino.userData.speedMult = spec.speedMult || 1.0;
  dino.userData.scaleMult = spec.scaleMult || 1.0;
  return dino;
}

/**
 * Make an enemy/food dino. Stage controls its size (0..4).
 * speciesKey selects the dinosaur kind.
 */
export function buildEnemyDino(speciesKey, stage) {
  const spec = SPECIES[speciesKey];
  if (!spec) throw new Error(`Unknown species: ${speciesKey}`);
  const dino = createDinoMeshSync(speciesKey);
  const scaleMult = spec.scaleMult || 1.0;
  const effectiveScale = STAGE_SCALE[stage] * scaleMult;
  dino.userData.kind = 'enemy';
  dino.userData.species = speciesKey;
  dino.userData.stage = stage;
  dino.userData.scale = effectiveScale;
  dino.scale.setScalar(effectiveScale);
  // Pteranodons float a bit off the ground
  if (speciesKey === 'ptero') {
    dino.userData.flyHeight = 1.5 + Math.random() * 1.0;
    dino.userData.flying = true;
  }
  dino.userData.walkPhase = Math.random() * Math.PI * 2;
  dino.userData.wanderTimer = 0;
  dino.userData.wanderDir = new THREE.Vector3();
  dino.userData.speed = (2 + stage * 0.6) * (spec.speedMult || 1.0);
  dino.userData.nutrition = 2 + stage * 4;
  dino.userData.size = effectiveScale * 1.5;
  dino.add(buildDangerRing(dino));
  return dino;
}

// Floor ring rendered under every enemy. Recolored each frame in the
// main update loop based on whether the player is big enough to eat
// them: green = safe to eat, red = will eat you. Built on a unique
// material so every enemy can be colored independently.
function buildDangerRing(dino) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2aff3a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.45, 24), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.renderOrder = 2;
  ring.userData.isDangerRing = true;
  dino.userData.dangerRing = ring;
  dino.userData.dangerRingMat = mat;
  return ring;
}

/**
 * Small critter — always edible regardless of player stage.
 */
export function buildCritterEnt() {
  const colors = [0xc4a050, 0xa07a40, 0x8aa050, 0xc46a50];
  const c = colors[Math.floor(Math.random() * colors.length)];
  const cr = buildCritter(c);
  cr.userData.kind = 'critter';
  cr.userData.walkPhase = Math.random() * Math.PI * 2;
  cr.userData.wanderTimer = 0;
  cr.userData.wanderDir = new THREE.Vector3(
    Math.random() - 0.5,
    0,
    Math.random() - 0.5
  ).normalize();
  cr.userData.speed = 3;
  cr.userData.nutrition = 2;
  cr.userData.size = 0.5;
  cr.userData.fleeing = false;
  return cr;
}

/**
 * Populate the world with critters + enemies across all species.
 */
export function populate(scene, playerPos) {
  const group = new THREE.Group();
  scene.add(group);

  // Critters
  for (let i = 0; i < 25; i++) {
    const cr = buildCritterEnt();
    placeRandom(cr, playerPos);
    group.add(cr);
  }

  // Mix: enough at every stage to always have prey and predator nearby
  const stageMix = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 0, 1, 2, 3];
  for (const stage of stageMix) {
    const speciesKey = pickRandomSpecies();
    const d = buildEnemyDino(speciesKey, stage);
    const minDist = 14 + stage * 12;
    placeRandom(d, playerPos, minDist);
    group.add(d);
  }

  return group;
}

function pickRandomSpecies() {
  return ALL_SPECIES[Math.floor(Math.random() * ALL_SPECIES.length)];
}

function placeRandom(obj, playerPos, minDist = 14) {
  for (let tries = 0; tries < 30; tries++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const dx = x - playerPos.x;
    const dz = z - playerPos.z;
    if (Math.hypot(dx, dz) > minDist) {
      obj.position.set(x, getHeightAt(x, z), z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      return;
    }
  }
  const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  obj.position.set(x, getHeightAt(x, z), z);
}

export function spawnEnemy(group, playerPos, playerStage = 0) {
  const stage = Math.max(
    0,
    Math.min(4, playerStage + (Math.floor(Math.random() * 3) - 1))
  );
  const speciesKey = pickRandomSpecies();
  const d = buildEnemyDino(speciesKey, stage);
  placeRandom(d, playerPos, 20 + stage * 6);
  group.add(d);
  return d;
}

export function spawnCritter(group, playerPos) {
  const cr = buildCritterEnt();
  placeRandom(cr, playerPos, 12);
  group.add(cr);
  return cr;
}
