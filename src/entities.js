import * as THREE from 'three';
import {
  buildTRex,
  buildTriceratops,
  buildCritter,
} from './dinos.js';
import { WORLD_SIZE } from './world.js';

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

export function buildPlayer(species) {
  const dino =
    species === 'trex' ? buildTRex(0x8b3a3a) : buildTriceratops(0x5a7a3a);
  dino.userData.species = species;
  dino.userData.kind = 'player';
  dino.userData.growth = 0;
  dino.userData.stage = 0;
  dino.userData.walkPhase = 0;
  dino.userData.chompTimer = 0;
  return dino;
}

/**
 * Make an enemy/food dino. Stage controls its size (0..4).
 * Type 'trex' or 'trike' for variety.
 */
export function buildEnemyDino(type, stage) {
  const colors = {
    trex: [0x8b5a3a, 0x6a3a2a, 0x9a4a5a, 0x8b3a3a],
    trike: [0x6a8a4a, 0x4a7a3a, 0x7a9a5a, 0x5a7a3a],
  };
  const c = colors[type][Math.floor(Math.random() * colors[type].length)];
  const dino =
    type === 'trex' ? buildTRex(c) : buildTriceratops(c);
  dino.userData.kind = 'enemy';
  dino.userData.species = type;
  dino.userData.stage = stage;
  dino.userData.scale = STAGE_SCALE[stage];
  dino.scale.setScalar(STAGE_SCALE[stage]);
  dino.userData.walkPhase = Math.random() * Math.PI * 2;
  dino.userData.wanderTimer = 0;
  dino.userData.wanderDir = new THREE.Vector3();
  dino.userData.speed = 2 + stage * 0.6;
  // Nutrition scales with size
  dino.userData.nutrition = 2 + stage * 4;
  dino.userData.size = STAGE_SCALE[stage] * 1.5;
  return dino;
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
 * Populate the world with critters + enemies.
 */
export function populate(scene, playerPos) {
  const group = new THREE.Group();
  scene.add(group);

  // ~ 25 critters
  for (let i = 0; i < 25; i++) {
    const cr = buildCritterEnt();
    placeRandom(cr, playerPos);
    group.add(cr);
  }

  // ~ 18 enemy dinos across all stages (so there's always something to chase you AND eat)
  const mix = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 0, 1, 2, 3];
  for (const stage of mix) {
    const type = Math.random() < 0.5 ? 'trex' : 'trike';
    const d = buildEnemyDino(type, stage);
    // Bigger enemies spawn farther from the player so kids aren't immediately swarmed
    const minDist = 14 + stage * 12;
    placeRandom(d, playerPos, minDist);
    group.add(d);
  }

  return group;
}

function placeRandom(obj, playerPos, minDist = 14) {
  for (let tries = 0; tries < 30; tries++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const dx = x - playerPos.x;
    const dz = z - playerPos.z;
    if (Math.hypot(dx, dz) > minDist) {
      obj.position.set(x, 0, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      return;
    }
  }
  obj.position.set(
    (Math.random() - 0.5) * WORLD_SIZE * 1.7,
    0,
    (Math.random() - 0.5) * WORLD_SIZE * 1.7
  );
}

// Spawn a single new enemy somewhere far from the player.
// playerStage lets us bias toward dinos near the player's current size.
export function spawnEnemy(group, playerPos, playerStage = 0) {
  // Bias toward dinos within ±1 of player stage so there's always interesting prey/predator
  const stage = Math.max(
    0,
    Math.min(4, playerStage + (Math.floor(Math.random() * 3) - 1))
  );
  const type = Math.random() < 0.5 ? 'trex' : 'trike';
  const d = buildEnemyDino(type, stage);
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
