import * as THREE from 'three';
import { PLAYABLE_RADIUS } from './world.js';

// Air enemies (Phase C): helicopters, fighter jets, drones. All live in
// a separate `airEnemies` THREE.Group so the dino update loop doesn't
// have to special-case flying behavior. Eaten by AOE/beam abilities the
// same way regular enemies are — main.js extends consumeAround/Cone to
// include this group.
//
// Each builder returns a Group with userData.kind = 'air' and a
// .airType ('heli' | 'jet' | 'drone'). updateAirEnemy is the single
// per-frame tick.

const FLAT = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FLAT(color));
  m.castShadow = true;
  return m;
}

// ---------- Helicopter ----------

export function buildHelicopter() {
  const root = new THREE.Group();
  const body = box(0.85, 0.55, 1.5, 0x5a6a7a);
  root.add(body);
  // Cockpit window glass blob
  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a3a55 })
  );
  cockpit.scale.set(1.1, 0.7, 1.2);
  cockpit.position.set(0, 0.1, -0.55);
  root.add(cockpit);
  // Tail boom
  const tail = box(0.22, 0.22, 1.4, 0x4a5a6a);
  tail.position.set(0, 0.08, 1.0);
  root.add(tail);
  // Tail fin
  const fin = box(0.06, 0.45, 0.3, 0x3a4a5a);
  fin.position.set(0, 0.32, 1.65);
  root.add(fin);
  // Skids
  for (const x of [-0.32, 0.32]) {
    const skid = box(0.06, 0.06, 1.0, 0x3a3a3a);
    skid.position.set(x, -0.42, 0.0);
    root.add(skid);
    const strut1 = box(0.06, 0.2, 0.06, 0x3a3a3a);
    strut1.position.set(x, -0.3, -0.35);
    root.add(strut1);
    const strut2 = box(0.06, 0.2, 0.06, 0x3a3a3a);
    strut2.position.set(x, -0.3, 0.35);
    root.add(strut2);
  }
  // Main rotor — a thin spinning disc (4 blades + a flat opacity disc)
  const rotorHub = new THREE.Group();
  rotorHub.position.set(0, 0.55, 0);
  for (let i = 0; i < 4; i++) {
    const blade = box(0.08, 0.04, 1.5, 0x222222);
    blade.rotation.y = (i / 4) * Math.PI * 2;
    rotorHub.add(blade);
  }
  // Translucent motion-blur disc
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 18),
    new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  blur.rotation.x = -Math.PI / 2;
  rotorHub.add(blur);
  root.add(rotorHub);
  // Tail rotor
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.13, 0.18, 1.7);
  for (let i = 0; i < 2; i++) {
    const blade = box(0.04, 0.04, 0.45, 0x222222);
    blade.rotation.z = (i / 2) * Math.PI;
    tailRotor.add(blade);
  }
  root.add(tailRotor);
  // Telegraph laser sight — added on the fly when about to fire
  const laser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 20, 6),
    new THREE.MeshBasicMaterial({
      color: 0xff3a3a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  laser.rotation.x = -Math.PI / 2;
  laser.position.set(0, -0.2, 10);
  root.add(laser);

  root.userData.kind = 'air';
  root.userData.airType = 'heli';
  root.userData.rotor = rotorHub;
  root.userData.tailRotor = tailRotor;
  root.userData.laser = laser;
  root.userData.flyHeight = 7 + Math.random() * 3;
  root.userData.circleAngle = Math.random() * Math.PI * 2;
  root.userData.circleRadius = 18 + Math.random() * 8;
  root.userData.size = 1.3;
  root.userData.score = 35;
  root.userData.nutrition = 5;
  root.userData.atomicCharge = 8;
  root.userData.fireTimer = 2.5 + Math.random() * 2.0;
  root.userData.telegraph = 0;
  return root;
}

// ---------- Fighter Jet ----------

export function buildJet() {
  const root = new THREE.Group();
  // Cone fuselage
  const fuselage = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 2.4, 8),
    FLAT(0xb0b8c0)
  );
  fuselage.rotation.x = -Math.PI / 2;
  fuselage.position.z = -0.3;
  root.add(fuselage);
  // Delta wings — flat planes
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(1.6, 0.6);
  wingShape.lineTo(1.6, 0.95);
  wingShape.lineTo(0, 0.4);
  wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x98a0a8, side: THREE.DoubleSide });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.rotation.x = -Math.PI / 2;
  wingL.position.set(0, 0, 0.2);
  wingL.scale.x = -1;
  root.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.rotation.x = -Math.PI / 2;
  wingR.position.set(0, 0, 0.2);
  root.add(wingR);
  // Tail fin
  const fin = box(0.06, 0.5, 0.55, 0x707880);
  fin.position.set(0, 0.27, 0.85);
  root.add(fin);
  // Engine glow
  const exhaust = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.85 })
  );
  exhaust.position.set(0, 0, 0.95);
  root.add(exhaust);

  root.userData.kind = 'air';
  root.userData.airType = 'jet';
  root.userData.exhaust = exhaust;
  root.userData.flyHeight = 11 + Math.random() * 3;
  root.userData.size = 1.6;
  root.userData.score = 50;
  root.userData.nutrition = 7;
  root.userData.atomicCharge = 10;
  // Strafe state: direction (+/-1 X), banking phase 0..1
  root.userData.strafeDir = Math.random() < 0.5 ? -1 : 1;
  root.userData.banking = 0;     // 0 = straight flight, 1 = mid-bank
  root.userData.bankTimer = 0;
  return root;
}

// ---------- Drone (single unit; spawn in groups of 5) ----------

export function buildDrone() {
  const root = new THREE.Group();
  // Tiny cube hub
  const hub = box(0.32, 0.18, 0.32, 0x3a3a4a);
  root.add(hub);
  // 4 arm rotors
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
    const arm = box(0.06, 0.05, 0.06, 0x2a2a3a);
    arm.position.set(x, 0.03, z);
    root.add(arm);
    const rotor = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 10),
      new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    rotor.rotation.x = -Math.PI / 2;
    rotor.position.set(x, 0.08, z);
    root.add(rotor);
  }
  // Single red status LED
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a })
  );
  led.position.set(0, 0.13, -0.18);
  root.add(led);

  root.userData.kind = 'air';
  root.userData.airType = 'drone';
  root.userData.led = led;
  root.userData.flyHeight = 4 + Math.random() * 2;
  root.userData.orbitAngle = Math.random() * Math.PI * 2;
  root.userData.orbitRadius = 10 + Math.random() * 8;
  root.userData.size = 0.6;
  root.userData.score = 8;
  root.userData.nutrition = 1;
  root.userData.atomicCharge = 2;
  root.userData.bobPhase = Math.random() * Math.PI * 2;
  return root;
}

// ---------- Spawn helpers ----------

export function spawnAirEnemies(scene, playerPos, counts = {}) {
  const group = new THREE.Group();
  group.userData.kind = 'airEnemies';
  const nHeli  = counts.heli  ?? 1;
  const nJet   = counts.jet   ?? 1;
  const nDrone = counts.drone ?? 0;

  for (let i = 0; i < nHeli; i++) {
    const h = buildHelicopter();
    const ang = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 18;
    h.position.set(
      playerPos.x + Math.cos(ang) * dist,
      h.userData.flyHeight,
      playerPos.z + Math.sin(ang) * dist
    );
    group.add(h);
  }
  for (let i = 0; i < nJet; i++) {
    const j = buildJet();
    const startX = j.userData.strafeDir > 0 ? -PLAYABLE_RADIUS + 5 : PLAYABLE_RADIUS - 5;
    j.position.set(startX, j.userData.flyHeight, playerPos.z + (Math.random() - 0.5) * 40);
    group.add(j);
  }
  for (let i = 0; i < nDrone; i++) {
    const d = buildDrone();
    const ang = (i / Math.max(1, nDrone)) * Math.PI * 2;
    const dist = 12 + Math.random() * 4;
    d.position.set(
      playerPos.x + Math.cos(ang) * dist,
      d.userData.flyHeight,
      playerPos.z + Math.sin(ang) * dist
    );
    group.add(d);
  }
  scene.add(group);
  return group;
}

// ---------- Per-frame update ----------

const _tmp = new THREE.Vector3();
const WORLD_LIMIT = PLAYABLE_RADIUS - 4;

export function updateAirEnemies(group, dt, playerPos, projectilePool, onProjectileHit) {
  if (!group) return;
  for (const ent of group.children) {
    const t = ent.userData.airType;
    if (t === 'heli')  updateHelicopter(ent, dt, playerPos, projectilePool);
    else if (t === 'jet')  updateJet(ent, dt, playerPos, projectilePool);
    else if (t === 'drone') updateDrone(ent, dt, playerPos);
  }
}

function updateHelicopter(ent, dt, playerPos, projectilePool) {
  const u = ent.userData;
  // Spin rotors
  u.rotor.rotation.y += dt * 18;
  if (u.tailRotor) u.tailRotor.rotation.x += dt * 22;
  // Lazy circle around the player
  u.circleAngle += dt * 0.25;
  const targetX = playerPos.x + Math.cos(u.circleAngle) * u.circleRadius;
  const targetZ = playerPos.z + Math.sin(u.circleAngle) * u.circleRadius;
  const targetY = u.flyHeight;
  ent.position.x += (targetX - ent.position.x) * Math.min(1, dt * 0.8);
  ent.position.z += (targetZ - ent.position.z) * Math.min(1, dt * 0.8);
  ent.position.y += (targetY - ent.position.y) * Math.min(1, dt * 2);
  // Face the player (yaw)
  const dx = playerPos.x - ent.position.x;
  const dz = playerPos.z - ent.position.z;
  ent.rotation.y = Math.atan2(-dx, -dz);

  // Fire cycle: telegraph (laser sight visible) → fire → recharge
  u.fireTimer -= dt;
  if (u.fireTimer < 1.5 && u.fireTimer > 0) {
    u.telegraph = Math.min(1, u.telegraph + dt * 2);
    u.laser.material.opacity = u.telegraph * 0.75;
  } else {
    u.telegraph = Math.max(0, u.telegraph - dt * 3);
    u.laser.material.opacity = u.telegraph * 0.75;
  }
  if (u.fireTimer <= 0 && projectilePool) {
    // Fire a missile arced toward the player's current position
    const origin = ent.position.clone();
    origin.y -= 0.2;
    const aim = _tmp.set(playerPos.x - origin.x, 0, playerPos.z - origin.z);
    const horizDist = aim.length();
    aim.normalize();
    const speed = 10 + Math.min(horizDist * 0.3, 6);
    // Gentle arc: forward velocity + slight upward initial component
    projectilePool.fire(
      origin,
      new THREE.Vector3(aim.x * speed, 2.5, aim.z * speed),
      'missile',
      3.0,
    );
    u.fireTimer = 3.0 + Math.random() * 1.5;
    u.telegraph = 0;
    u.laser.material.opacity = 0;
  }
}

function updateJet(ent, dt, playerPos, projectilePool) {
  const u = ent.userData;
  u.exhaust.material.opacity = 0.6 + Math.sin(performance.now() * 0.04) * 0.25;

  if (u.banking > 0) {
    // Banking turn: slower, tilted, vulnerable
    u.banking += dt * 1.0;
    ent.rotation.z = Math.sin(u.banking * Math.PI) * 0.9 * u.strafeDir;
    ent.rotation.y += dt * 1.4 * -u.strafeDir;
    if (u.banking >= 1) {
      u.banking = 0;
      u.strafeDir *= -1;
      ent.rotation.y = u.strafeDir > 0 ? -Math.PI / 2 : Math.PI / 2;
      ent.rotation.z = 0;
    }
  } else {
    // Straight strafe
    const speed = 22;
    ent.position.x += u.strafeDir * speed * dt;
    ent.position.y += (u.flyHeight - ent.position.y) * Math.min(1, dt * 2);
    ent.rotation.y = u.strafeDir > 0 ? -Math.PI / 2 : Math.PI / 2;
    ent.rotation.z = 0;
    // Trigger bank at map edge
    if ((u.strafeDir > 0 && ent.position.x > WORLD_LIMIT) ||
        (u.strafeDir < 0 && ent.position.x < -WORLD_LIMIT)) {
      u.banking = 0.001;
    }
  }
}

function updateDrone(ent, dt, playerPos) {
  const u = ent.userData;
  // Orbit + bob
  u.orbitAngle += dt * 0.7;
  u.bobPhase += dt * 3;
  const targetX = playerPos.x + Math.cos(u.orbitAngle) * u.orbitRadius;
  const targetZ = playerPos.z + Math.sin(u.orbitAngle) * u.orbitRadius;
  const targetY = u.flyHeight + Math.sin(u.bobPhase) * 0.4;
  ent.position.x += (targetX - ent.position.x) * Math.min(1, dt * 1.2);
  ent.position.z += (targetZ - ent.position.z) * Math.min(1, dt * 1.2);
  ent.position.y += (targetY - ent.position.y) * Math.min(1, dt * 3);
  // LED blink
  u.led.material.color.setHex((Math.sin(performance.now() * 0.012) > 0) ? 0xff3a3a : 0x441010);
}
