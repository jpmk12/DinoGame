import * as THREE from 'three';
import { WORLD_SIZE } from './world.js';
import { createDinoMeshSync } from './modelLoader.js';
import { SPECIES, ALL_SPECIES } from './dinos.js';

export const EGG_TAPS_TO_HATCH = 5;
export const EGG_TAP_RANGE = 1.6;     // how close the player must stand
export const BABY_DURATION = 30;       // seconds baby stays alive
export const BABY_EAT_RADIUS = 0.7;    // baby's eating reach

function buildEgg() {
  const root = new THREE.Group();

  // Nest — ring of twigs
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const twig = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.12, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a })
    );
    twig.position.set(Math.cos(angle) * 0.55, 0.06, Math.sin(angle) * 0.55);
    twig.rotation.y = angle + Math.PI / 2;
    twig.castShadow = true;
    twig.receiveShadow = true;
    root.add(twig);
  }
  // Inner nest pad
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12),
    new THREE.MeshLambertMaterial({ color: 0x8a6a3a })
  );
  pad.position.y = 0.08;
  pad.receiveShadow = true;
  root.add(pad);

  // Egg
  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 12),
    new THREE.MeshLambertMaterial({
      color: 0xfff4d0,
      emissive: 0xffeacc,
      emissiveIntensity: 0.25,
    })
  );
  egg.scale.y = 1.45;
  egg.position.y = 0.62;
  egg.castShadow = true;
  root.add(egg);

  // Brown spots
  for (let i = 0; i < 6; i++) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a })
    );
    const angle = Math.random() * Math.PI * 2;
    const yOff = (Math.random() - 0.5) * 0.7;
    spot.position.set(
      Math.cos(angle) * 0.34,
      0.62 + yOff,
      Math.sin(angle) * 0.34
    );
    root.add(spot);
  }

  // Glow halo
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffe89a,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    })
  );
  halo.scale.y = 1.45;
  halo.position.y = 0.62;
  root.add(halo);

  // Crack overlay (filled progressively as the player taps)
  const crackGroup = new THREE.Group();
  root.add(crackGroup);

  root.userData.kind = 'egg';
  root.userData.cracks = 0;
  root.userData.egg = egg;
  root.userData.halo = halo;
  root.userData.crackGroup = crackGroup;
  root.userData.bobPhase = Math.random() * Math.PI * 2;
  root.userData.wobbleTimer = 0;
  return root;
}

function addCrack(eggRoot) {
  eggRoot.userData.cracks += 1;
  const crackGroup = eggRoot.userData.crackGroup;
  const crack = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.02, 0.18 + Math.random() * 0.1),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
  );
  const angle = Math.random() * Math.PI * 2;
  const yOff = (Math.random() - 0.5) * 0.65;
  crack.position.set(
    Math.cos(angle) * 0.36,
    0.62 + yOff,
    Math.sin(angle) * 0.36
  );
  crack.rotation.y = -angle;
  crack.rotation.z = (Math.random() - 0.5) * Math.PI;
  crackGroup.add(crack);
  eggRoot.userData.wobbleTimer = 0.4;
}

function placeRandom(obj, playerPos, minDist = 16) {
  for (let tries = 0; tries < 25; tries++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    if (Math.hypot(x - playerPos.x, z - playerPos.z) > minDist) {
      obj.position.set(x, 0, z);
      return;
    }
  }
  obj.position.set(
    (Math.random() - 0.5) * WORLD_SIZE * 1.7,
    0,
    (Math.random() - 0.5) * WORLD_SIZE * 1.7
  );
}

export function spawnEggs(scene, playerPos, count = 4) {
  const group = new THREE.Group();
  scene.add(group);
  for (let i = 0; i < count; i++) {
    const e = buildEgg();
    placeRandom(e, playerPos);
    group.add(e);
  }
  return group;
}

export function spawnEgg(group, playerPos) {
  const e = buildEgg();
  placeRandom(e, playerPos);
  group.add(e);
  return e;
}

export function animateEggs(group, dt) {
  for (const e of group.children) {
    e.userData.bobPhase += dt * 2;
    const ph = e.userData.bobPhase;
    const egg = e.userData.egg;
    if (egg) {
      egg.position.y = 0.62 + Math.sin(ph) * 0.04;
      if (e.userData.wobbleTimer > 0) {
        e.userData.wobbleTimer -= dt;
        const intensity = e.userData.wobbleTimer / 0.4;
        egg.rotation.z = Math.sin(ph * 25) * 0.25 * intensity;
      } else {
        egg.rotation.z *= 0.85;
      }
    }
    const halo = e.userData.halo;
    if (halo) {
      const s = 1 + Math.sin(ph * 1.5) * 0.12;
      halo.scale.x = s;
      halo.scale.z = s;
      halo.material.opacity = 0.14 + Math.sin(ph * 1.5) * 0.08;
    }
  }
}

export function eggNearby(group, playerPos, range = EGG_TAP_RANGE) {
  if (!group) return null;
  let closest = null;
  let bestDist = range;
  for (const e of group.children) {
    const d = e.position.distanceTo(playerPos);
    if (d < bestDist) {
      closest = e;
      bestDist = d;
    }
  }
  return closest;
}

// Returns true if this tap hatched the egg.
export function tapEgg(eggRoot) {
  addCrack(eggRoot);
  return eggRoot.userData.cracks >= EGG_TAPS_TO_HATCH;
}

/**
 * Build a baby dino — small scaled-down version of a species.
 * Speciously: the picked species comes from the parent; for variety, callers
 * can pass any species key.
 */
export function buildBabyDino(speciesKey) {
  const key = SPECIES[speciesKey] ? speciesKey : ALL_SPECIES[0];
  const baby = createDinoMeshSync(key);
  baby.scale.setScalar(0.22);
  baby.userData.kind = 'baby';
  baby.userData.species = key;
  baby.userData.lifetime = BABY_DURATION;
  baby.userData.maxLifetime = BABY_DURATION;
  baby.userData.walkPhase = Math.random() * Math.PI * 2;
  baby.userData.followAngle = Math.random() * Math.PI * 2;
  baby.userData.chirpTimer = 2 + Math.random() * 3;
  return baby;
}
