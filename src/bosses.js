import * as THREE from 'three';
import { SPECIES } from './dinos.js';
import { createDinoMeshSync } from './modelLoader.js';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';

// One named boss per level. Each boss is a beefed-up dinosaur of a base
// species with extra scale, a glowing crown above its head (so you can
// spot it from far away), a healthbar, and aggressive AI.

export const BOSS_DATA = {
  lostWorld:   { name: 'The Apex',       species: 'trex',    scale: 2.3, health: 8,  color: 0xa84a3a, crown: 0xffd24a },
  volcano:     { name: 'Magmasaur',      species: 'spino',   scale: 2.4, health: 10, color: 0xff5a2a, crown: 0xff9a3a },
  tundra:      { name: 'Ice Titan',      species: 'stego',   scale: 2.3, health: 10, color: 0x88aacc, crown: 0xcfeaff },
  dinoPark:    { name: 'Park Captain',   species: 'raptor',  scale: 2.0, health: 8,  color: 0x4a8a4a, crown: 0xc04040 },
  night:       { name: 'Shadow Maw',     species: 'raptor',  scale: 2.2, health: 9,  color: 0x222a4a, crown: 0x88aaff },
  cityRampage: { name: 'The Brute',      species: 'titan',   scale: 1.5, health: 8,  color: 0x4a2a3a, crown: 0xff5a3a, speed: 2.4 },
  nightCity:   { name: 'Neon Wraith',    species: 'titan',   scale: 1.5, health: 8,  color: 0x2a3a55, crown: 0x66e6ff, speed: 2.4 },
};

export function buildBoss(levelKey) {
  const data = BOSS_DATA[levelKey];
  if (!data) return null;
  const spec = SPECIES[data.species];

  // Use the species' procedural builder with a unique color.
  const mesh = spec.build(data.color);
  mesh.scale.setScalar(data.scale);

  // Glowing emissive crown ring above the head — visible from far away.
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.22, 8, 18),
    new THREE.MeshLambertMaterial({
      color: data.crown,
      emissive: data.crown,
      emissiveIntensity: 1.2,
    })
  );
  crown.position.y = 3.4;
  crown.castShadow = false;
  mesh.add(crown);

  // Plus a vertical "marker" beacon so it's spottable across the world
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.05, 6, 8),
    new THREE.MeshBasicMaterial({
      color: data.crown,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  beacon.position.y = 6.5;
  mesh.add(beacon);

  // Danger ring at the feet, recolored by the main loop based on whether
  // the current player size can eat this boss. Same UX as regular enemies.
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff3a3a,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.45, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.renderOrder = 2;
  mesh.add(ring);
  mesh.userData.dangerRing = ring;
  mesh.userData.dangerRingMat = ringMat;

  mesh.userData.kind = 'boss';
  mesh.userData.name = data.name;
  mesh.userData.health = data.health;
  mesh.userData.maxHealth = data.health;
  // Speed: city bosses chase noticeably slower so the cramped streets stay
  // playable; outdoor bosses still hustle. Tuned down across the board for
  // young kids so the boss is catchable but not punishing.
  const baseSpeed = data.speed != null ? data.speed : (2.3 + data.scale * 0.5);
  mesh.userData.speed = baseSpeed;
  mesh.userData.scaleVal = data.scale;
  mesh.userData.size = data.scale * 1.5;
  mesh.userData.score = 200 + data.health * 8;
  mesh.userData.walkPhase = 0;
  mesh.userData.crown = crown;
  mesh.userData.beacon = beacon;
  mesh.userData.dying = false;
  mesh.userData.dyingTimer = 0;
  mesh.userData.hitFlash = 0;
  return mesh;
}

export function spawnBoss(scene, playerPos, levelKey) {
  const boss = buildBoss(levelKey);
  if (!boss) return null;
  // Place ~70+ units away in a random direction so you have time to grow
  // before it reaches you. City bosses spawn even farther because the
  // grid makes line-of-sight chases faster.
  const isCity = !!BOSS_DATA[levelKey] && BOSS_DATA[levelKey].species === 'titan';
  for (let tries = 0; tries < 10; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = (isCity ? 78 : 55) + Math.random() * 20;
    const x = Math.max(-PLAYABLE_RADIUS + 5, Math.min(PLAYABLE_RADIUS - 5,
      playerPos.x + Math.cos(ang) * dist));
    const z = Math.max(-PLAYABLE_RADIUS + 5, Math.min(PLAYABLE_RADIUS - 5,
      playerPos.z + Math.sin(ang) * dist));
    if (Math.hypot(x - playerPos.x, z - playerPos.z) >= 40) {
      boss.position.set(x, getHeightAt(x, z), z);
      break;
    }
  }
  scene.add(boss);
  return boss;
}

// Aggressive chase: always heads toward the player at boss.speed.
// Returns "hit" if the boss touched the player this frame (caller decides
// what happens — typically the player loses growth or is shoved back).
export function updateBoss(boss, dt, playerPos) {
  const u = boss.userData;
  if (u.dying) {
    u.dyingTimer += dt;
    boss.scale.multiplyScalar(1 - dt * 0.7);
    boss.rotation.y += dt * 6;
    if (u.crown) u.crown.material.emissiveIntensity = Math.max(0, 1.2 - u.dyingTimer * 2);
    return { hit: false, dead: u.dyingTimer > 1.2 };
  }

  const dx = playerPos.x - boss.position.x;
  const dz = playerPos.z - boss.position.z;
  const dist = Math.hypot(dx, dz) || 1;
  boss.position.x += (dx / dist) * u.speed * dt;
  boss.position.z += (dz / dist) * u.speed * dt;
  boss.rotation.y = Math.atan2(-(dx / dist), -(dz / dist));
  boss.position.y = getHeightAt(boss.position.x, boss.position.z);

  // Crown pulses
  if (u.crown) {
    u.walkPhase += dt * 4;
    u.crown.material.emissiveIntensity = 1.0 + Math.sin(u.walkPhase) * 0.4;
    u.crown.rotation.y += dt * 1.2;
  }
  // Beacon fades to nothing as the player approaches (it's a guide)
  if (u.beacon) {
    const a = Math.min(0.6, dist / 60 * 0.6);
    u.beacon.material.opacity = a;
  }
  if (u.hitFlash > 0) {
    u.hitFlash = Math.max(0, u.hitFlash - dt);
  }

  return { hit: dist < 3.0 + u.scaleVal, dead: false };
}

export function damageBoss(boss, dmg) {
  if (!boss || boss.userData.dying) return 0;
  boss.userData.health = Math.max(0, boss.userData.health - dmg);
  boss.userData.hitFlash = 0.2;
  if (boss.userData.health <= 0) {
    boss.userData.dying = true;
    boss.userData.dyingTimer = 0;
    return boss.userData.score;
  }
  return 0;
}
