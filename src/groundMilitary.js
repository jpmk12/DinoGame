import * as THREE from 'three';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';

// Phase D: ground military enemies — tanks, missile silos, soldier
// squads. All live in a `groundMilitary` THREE.Group so they don't
// pollute the dino-AI loop. Tanks and silos shoot via the shared
// projectile pool; soldiers are pure prey.

const FLAT = (color) => new THREE.MeshLambertMaterial({ color });
const _tmp = new THREE.Vector3();

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FLAT(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- D1. Tank ----------

export function buildTank() {
  const root = new THREE.Group();
  const olive = 0x5a6a3a;
  const darker = 0x3a4a24;
  // Hull
  const hull = box(2.0, 0.6, 3.0, olive);
  hull.position.y = 0.6;
  root.add(hull);
  // Skirt (lower hull)
  const skirt = box(2.2, 0.3, 3.0, darker);
  skirt.position.y = 0.3;
  root.add(skirt);
  // Treads (animated by scrolling material offset later — for now, two
  // dark slabs)
  for (const side of [-1, 1]) {
    const tread = box(0.3, 0.5, 3.0, 0x1a1a1a);
    tread.position.set(side * 1.05, 0.35, 0);
    root.add(tread);
    // Tread detail blocks
    for (let i = -3; i <= 3; i++) {
      const cleat = box(0.32, 0.08, 0.18, 0x2a2a2a);
      cleat.position.set(side * 1.05, 0.35, i * 0.4);
      root.add(cleat);
    }
  }
  // Turret base
  const turret = new THREE.Group();
  turret.position.set(0, 1.05, 0.1);
  const turretBody = box(1.4, 0.5, 1.4, olive);
  turret.add(turretBody);
  // Barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 1.8, 8),
    FLAT(0x3a4a24)
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.05, -1.0);
  turret.add(barrel);
  // Muzzle brake
  const muzzle = box(0.2, 0.2, 0.25, 0x1a1a1a);
  muzzle.position.set(0, 0.05, -1.95);
  turret.add(muzzle);
  root.add(turret);
  // Antenna
  const antenna = box(0.04, 0.7, 0.04, 0x1a1a1a);
  antenna.position.set(0.4, 1.65, 0.5);
  root.add(antenna);

  root.userData.kind = 'ground';
  root.userData.groundType = 'tank';
  root.userData.turret = turret;
  root.userData.barrel = barrel;
  root.userData.muzzle = muzzle;
  root.userData.size = 2.5;
  root.userData.score = 60;
  root.userData.nutrition = 8;
  root.userData.atomicCharge = 12;
  root.userData.speed = 1.8;
  root.userData.wanderTimer = 0;
  root.userData.wanderDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  root.userData.fireTimer = 3.0 + Math.random() * 2;
  return root;
}

// ---------- D2. Missile Silo ----------

export function buildMissileSilo() {
  const root = new THREE.Group();
  // Concrete base
  const base = box(3.0, 0.4, 3.0, 0x9a988a);
  base.position.y = 0.2;
  root.add(base);
  // Silo tube
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.95, 2.4, 12),
    FLAT(0x707068)
  );
  tube.position.y = 1.6;
  tube.castShadow = true;
  root.add(tube);
  // Yellow hazard stripes (decorative cylinder segments)
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.96, 0.96, 0.18, 12, 1, true),
      FLAT(0xffd24a)
    );
    stripe.position.y = 0.8 + i * 0.7;
    root.add(stripe);
  }
  // Top hatch (animated open during fire)
  const hatch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.12, 12),
    FLAT(0x3a3a3a)
  );
  hatch.position.y = 2.86;
  root.add(hatch);
  // Warning light
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a })
  );
  light.position.set(1.2, 0.6, 1.2);
  root.add(light);

  root.userData.kind = 'ground';
  root.userData.groundType = 'silo';
  root.userData.hatch = hatch;
  root.userData.light = light;
  root.userData.size = 2.5;
  root.userData.score = 50;
  root.userData.nutrition = 6;
  root.userData.atomicCharge = 10;
  root.userData.fireTimer = 6.0 + Math.random() * 3;
  root.userData.hatchPhase = 0; // 0..1 open animation
  return root;
}

// ---------- D3. Soldier ----------

export function buildSoldier() {
  const root = new THREE.Group();
  const skin = 0xeac08a;
  const fatigue = 0x4a5a3a;
  const boot = 0x2a1a14;
  // Torso
  const torso = box(0.32, 0.45, 0.22, fatigue);
  torso.position.y = 0.85;
  root.add(torso);
  // Head
  const head = box(0.22, 0.22, 0.22, skin);
  head.position.y = 1.2;
  root.add(head);
  // Helmet
  const helmet = box(0.26, 0.12, 0.26, 0x3a4a2a);
  helmet.position.y = 1.32;
  root.add(helmet);
  // Arms
  for (const side of [-1, 1]) {
    const arm = box(0.1, 0.4, 0.1, fatigue);
    arm.position.set(side * 0.22, 0.82, 0);
    root.add(arm);
  }
  // Legs (animated)
  const legL = new THREE.Group();
  legL.position.set(-0.1, 0.55, 0);
  const legLMesh = box(0.13, 0.55, 0.13, fatigue);
  legLMesh.position.y = -0.25;
  legL.add(legLMesh);
  const bootL = box(0.16, 0.1, 0.2, boot);
  bootL.position.y = -0.55;
  legL.add(bootL);
  root.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.1, 0.55, 0);
  const legRMesh = box(0.13, 0.55, 0.13, fatigue);
  legRMesh.position.y = -0.25;
  legR.add(legRMesh);
  const bootR = box(0.16, 0.1, 0.2, boot);
  bootR.position.y = -0.55;
  legR.add(bootR);
  root.add(legR);
  // Rifle slung across chest
  const rifle = box(0.05, 0.05, 0.55, 0x2a1a14);
  rifle.position.set(0.05, 0.95, -0.18);
  rifle.rotation.x = -0.3;
  root.add(rifle);

  root.userData.kind = 'ground';
  root.userData.groundType = 'soldier';
  root.userData.legL = legL;
  root.userData.legR = legR;
  root.userData.size = 0.5;
  root.userData.score = 12;
  root.userData.nutrition = 2;
  root.userData.atomicCharge = 3;
  root.userData.speed = 6.5;
  root.userData.walkPhase = Math.random() * Math.PI * 2;
  root.userData.wanderDir = new THREE.Vector3();
  return root;
}

// ---------- Spawning ----------

export function spawnGroundMilitary(scene, playerPos, counts = {}) {
  const group = new THREE.Group();
  group.userData.kind = 'groundMilitary';
  const nTank    = counts.tank    ?? 0;
  const nSilo    = counts.silo    ?? 0;
  const nSoldier = counts.soldier ?? 0;

  for (let i = 0; i < nTank; i++) addAround(group, buildTank(), playerPos, 18, 40);
  for (let i = 0; i < nSilo; i++) addAround(group, buildMissileSilo(), playerPos, 22, 50);
  for (let i = 0; i < nSoldier; i++) addAround(group, buildSoldier(), playerPos, 10, 26);

  scene.add(group);
  return group;
}

function addAround(group, mesh, playerPos, minDist, maxDist) {
  for (let tries = 0; tries < 8; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = playerPos.x + Math.cos(ang) * dist;
    const z = playerPos.z + Math.sin(ang) * dist;
    if (Math.abs(x) > PLAYABLE_RADIUS - 3 || Math.abs(z) > PLAYABLE_RADIUS - 3) continue;
    mesh.position.set(x, getHeightAt(x, z), z);
    group.add(mesh);
    return;
  }
}

// ---------- Per-frame update ----------

export function updateGroundMilitary(group, dt, playerPos, projectilePool) {
  if (!group) return;
  for (const ent of group.children) {
    const t = ent.userData.groundType;
    if (t === 'tank')    updateTank(ent, dt, playerPos, projectilePool);
    else if (t === 'silo')    updateSilo(ent, dt, playerPos, projectilePool);
    else if (t === 'soldier') updateSoldier(ent, dt, playerPos);
  }
}

function updateTank(ent, dt, playerPos, projectilePool) {
  const u = ent.userData;
  // Slow wander — tanks don't aggressively pursue
  u.wanderTimer -= dt;
  if (u.wanderTimer <= 0) {
    u.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    u.wanderTimer = 3 + Math.random() * 3;
  }
  ent.position.x += u.wanderDir.x * u.speed * dt;
  ent.position.z += u.wanderDir.z * u.speed * dt;
  const lim = PLAYABLE_RADIUS - 3;
  ent.position.x = Math.max(-lim, Math.min(lim, ent.position.x));
  ent.position.z = Math.max(-lim, Math.min(lim, ent.position.z));
  ent.position.y = getHeightAt(ent.position.x, ent.position.z);
  // Body faces movement direction
  ent.rotation.y = Math.atan2(-u.wanderDir.x, -u.wanderDir.z);
  // Turret tracks the player
  const dx = playerPos.x - ent.position.x;
  const dz = playerPos.z - ent.position.z;
  const aimYaw = Math.atan2(-dx, -dz) - ent.rotation.y;
  let cur = u.turret.rotation.y;
  let diff = aimYaw - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  u.turret.rotation.y += diff * Math.min(1, dt * 2);
  // Fire shell at the player
  u.fireTimer -= dt;
  if (u.fireTimer <= 0 && projectilePool) {
    const muzzleWorld = new THREE.Vector3();
    u.muzzle.getWorldPosition(muzzleWorld);
    const aim = _tmp.set(playerPos.x - muzzleWorld.x, 0, playerPos.z - muzzleWorld.z);
    const horizDist = aim.length() || 1;
    aim.normalize();
    const speed = 16;
    projectilePool.fire(
      muzzleWorld,
      new THREE.Vector3(aim.x * speed, 4.0, aim.z * speed),
      'shell',
      3.0,
    );
    u.fireTimer = 3.5 + Math.random() * 2;
  }
}

function updateSilo(ent, dt, playerPos, projectilePool) {
  const u = ent.userData;
  // Warning light blinks faster as fire approaches
  const closeToFire = u.fireTimer < 1.5;
  u.light.material.color.setHex(
    Math.sin(performance.now() * (closeToFire ? 0.02 : 0.006)) > 0 ? 0xff3a3a : 0x441010
  );
  // Hatch animates open during the last 1s before fire
  let targetHatch = closeToFire ? 1 : 0;
  if (u.hatchPhase < targetHatch) u.hatchPhase = Math.min(1, u.hatchPhase + dt * 2);
  if (u.hatchPhase > targetHatch) u.hatchPhase = Math.max(0, u.hatchPhase - dt * 2);
  u.hatch.position.y = 2.86 + u.hatchPhase * 0.6;
  u.hatch.rotation.z = u.hatchPhase * 0.4;
  // Fire
  u.fireTimer -= dt;
  if (u.fireTimer <= 0 && projectilePool) {
    const muzzleWorld = new THREE.Vector3(ent.position.x, ent.position.y + 3, ent.position.z);
    // Shoot straight up; ballistic arc carries it back down toward player
    const aimX = playerPos.x - muzzleWorld.x;
    const aimZ = playerPos.z - muzzleWorld.z;
    const horizDist = Math.hypot(aimX, aimZ) || 1;
    // Pre-compute velocity to roughly land near the player after 3s
    const fall = 3.0;
    const vx = aimX / fall;
    const vz = aimZ / fall;
    projectilePool.fire(
      muzzleWorld,
      new THREE.Vector3(vx, 12, vz),
      'missile',
      4.0,
    );
    u.fireTimer = 7.0 + Math.random() * 3;
    u.hatchPhase = 0;
  }
}

function updateSoldier(ent, dt, playerPos) {
  const u = ent.userData;
  // Flee from player
  const dx = ent.position.x - playerPos.x;
  const dz = ent.position.z - playerPos.z;
  const dist = Math.hypot(dx, dz) || 1;
  if (dist < 22) {
    u.wanderDir.set(dx / dist, 0, dz / dist);
  }
  ent.position.x += u.wanderDir.x * u.speed * dt;
  ent.position.z += u.wanderDir.z * u.speed * dt;
  ent.position.y = getHeightAt(ent.position.x, ent.position.z);
  const lim = PLAYABLE_RADIUS - 3;
  ent.position.x = Math.max(-lim, Math.min(lim, ent.position.x));
  ent.position.z = Math.max(-lim, Math.min(lim, ent.position.z));
  ent.rotation.y = Math.atan2(-u.wanderDir.x, -u.wanderDir.z);
  // Leg swing for running animation
  u.walkPhase += dt * 14;
  const sw = Math.sin(u.walkPhase) * 0.7;
  u.legL.rotation.x = sw;
  u.legR.rotation.x = -sw;
}
