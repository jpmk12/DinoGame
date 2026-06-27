import * as THREE from 'three';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';

// Phase F landmarks. Each level type drops a handful of these into the
// world during setup. Topple-able items are flagged with kind='building'
// + score so the existing building topple path treats them like
// destructible structures. Reactor cores are special — eating one
// instantly fills the Atomic Charge meter.

const FLAT = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FLAT(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- Harbor: Oil Rig ----------
export function buildOilRig() {
  const root = new THREE.Group();
  const steel = 0x8a8a90;
  const orange = 0xc46a3a;
  const dark = 0x3a3a3a;
  // Square platform
  const deck = box(4.0, 0.5, 4.0, dark);
  deck.position.y = 3.0;
  root.add(deck);
  // 4 corner legs
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
    const leg = box(0.35, 6.0, 0.35, steel);
    leg.position.set(x, 0, z);
    root.add(leg);
  }
  // X-cross bracing on each face
  for (let i = 0; i < 4; i++) {
    const brace = box(4.0, 0.16, 0.16, steel);
    brace.position.y = 1.5;
    brace.rotation.y = (i / 4) * Math.PI * 2;
    brace.position.x = Math.cos(brace.rotation.y) * 1.7;
    brace.position.z = Math.sin(brace.rotation.y) * 1.7;
    root.add(brace);
  }
  // Derrick tower (4-leg pyramid)
  const tower = new THREE.Group();
  tower.position.y = 3.25;
  for (const [x, z] of [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]]) {
    const leg = box(0.15, 5.5, 0.15, orange);
    leg.position.set(x * 0.8, 2.75, z * 0.8);
    leg.rotation.x = (z > 0 ? -1 : 1) * 0.08;
    leg.rotation.z = (x > 0 ? -1 : 1) * 0.08;
    tower.add(leg);
  }
  // Crown
  const crown = box(1.5, 0.5, 1.5, orange);
  crown.position.y = 5.5;
  tower.add(crown);
  // Flame stack
  const stack = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.2, 8),
    new THREE.MeshLambertMaterial({
      color: 0xff7a3a,
      emissive: 0xff5a2a,
      emissiveIntensity: 1.2,
    })
  );
  stack.position.y = 6.4;
  tower.add(stack);
  root.add(tower);

  root.userData.kind = 'building';
  root.userData.size = 4.5;
  root.userData.score = 120;
  root.userData.health = 1;
  root.userData.subtype = 'oilRig';
  return root;
}

// ---------- Military: Radar Dish ----------
export function buildRadarDish() {
  const root = new THREE.Group();
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xcfcfcf, side: THREE.DoubleSide })
  );
  dish.scale.y = 0.4;
  dish.position.y = 4.0;
  dish.rotation.x = -0.7;
  root.add(dish);
  // Receiver pole
  const pole = box(0.18, 4.0, 0.18, 0x9a9a9a);
  pole.position.y = 2.0;
  root.add(pole);
  // Mast
  const stub = box(0.15, 0.6, 0.15, 0x6a6a6a);
  stub.position.set(0, 4.5, 0.7);
  root.add(stub);
  // Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.6, 10),
    FLAT(0x7a7a7a)
  );
  base.position.y = 0.3;
  root.add(base);
  // Animated yaw
  root.userData.kind = 'building';
  root.userData.size = 3.5;
  root.userData.score = 70;
  root.userData.health = 1;
  root.userData.subtype = 'radar';
  root.userData.dish = dish;
  return root;
}

// ---------- Power Plant: Cooling Tower ----------
export function buildCoolingTower() {
  const root = new THREE.Group();
  const concrete = 0xb8b0a4;
  // Hourglass profile
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.8, 8.5, 18, 8, true),
    FLAT(concrete)
  );
  tower.position.y = 4.25;
  tower.castShadow = true;
  tower.receiveShadow = true;
  root.add(tower);
  // Top rim
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.85, 1.85, 0.25, 18),
    FLAT(0x8a847a)
  );
  rim.position.y = 8.5;
  root.add(rim);
  // Steam cloud sitting on top (translucent sphere stack)
  const steamMat = new THREE.MeshLambertMaterial({
    color: 0xffffff, transparent: true, opacity: 0.6,
  });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.1, 8, 6), steamMat);
    puff.position.set(
      (Math.random() - 0.5) * 0.6,
      9.0 + i * 0.4,
      (Math.random() - 0.5) * 0.6,
    );
    root.add(puff);
  }

  root.userData.kind = 'building';
  root.userData.size = 5.0;
  root.userData.score = 150;
  root.userData.health = 1;
  root.userData.subtype = 'coolingTower';
  return root;
}

// ---------- Power Plant: Reactor Core (eat for instant full charge) ----------
export function buildReactorCore() {
  const root = new THREE.Group();
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 2.4, 14),
    new THREE.MeshLambertMaterial({
      color: 0xaaffaa,
      emissive: 0x66ff66,
      emissiveIntensity: 1.5,
    })
  );
  rod.position.y = 1.2;
  root.add(rod);
  // Housing
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.7, 1.5, 14, 1, true),
    FLAT(0x6a6a6a)
  );
  housing.position.y = 0.75;
  root.add(housing);
  // Base pad
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 0.3, 16),
    FLAT(0x44443a)
  );
  pad.position.y = 0.15;
  root.add(pad);
  // Sparkle ring above
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xaaffaa })
    );
    spark.position.set(Math.cos(ang) * 0.5, 2.5, Math.sin(ang) * 0.5);
    root.add(spark);
  }

  root.userData.kind = 'reactor';
  root.userData.size = 1.5;
  root.userData.score = 80;
  root.userData.atomicCharge = 100; // full meter
  root.userData.rod = rod;
  return root;
}

// ---------- Highway: Big Rig Truck (vehicles-like) ----------
export function buildBigRig() {
  const root = new THREE.Group();
  const cab = box(2.2, 1.8, 2.4, 0xc04030);
  cab.position.y = 1.3;
  root.add(cab);
  // Windshield
  const wind = box(2.0, 0.7, 0.1, 0x223344);
  wind.position.set(0, 1.7, -1.21);
  root.add(wind);
  // Cab roof
  const roof = box(2.2, 0.4, 0.5, 0xa03020);
  roof.position.set(0, 2.2, 0.3);
  root.add(roof);
  // Long trailer
  const trailer = box(2.5, 2.8, 6.0, 0xe6e0d4);
  trailer.position.set(0, 1.8, 3.5);
  root.add(trailer);
  // Hookup
  const link = box(0.4, 0.5, 0.6, 0x222222);
  link.position.set(0, 0.85, 0.85);
  root.add(link);
  // Wheels — 10 of them
  for (const z of [-1.0, -0.4, 2.0, 2.8, 5.0, 5.8]) {
    for (const x of [-1.05, 1.05]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.32, 10),
        FLAT(0x222222)
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.45, z);
      root.add(wheel);
    }
  }
  // Smoke stack
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8),
    FLAT(0x444444)
  );
  stack.position.set(0.85, 2.7, 0.3);
  root.add(stack);

  root.userData.kind = 'vehicle';
  root.userData.size = 2.5;
  root.userData.nutrition = 6;
  root.userData.score = 35;
  root.userData.speed = 12;
  return root;
}

// ---------- Lava Throne: Lava Pool (hazard + visual) ----------
export function buildLavaPool() {
  const root = new THREE.Group();
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 18),
    new THREE.MeshLambertMaterial({
      color: 0xff7a2a,
      emissive: 0xff5a1a,
      emissiveIntensity: 1.0,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.05;
  root.add(pool);
  // Darker crust ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.0, 18),
    new THREE.MeshLambertMaterial({ color: 0x2a0a04, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  root.add(ring);

  root.userData.kind = 'lava';
  root.userData.size = 4.0;
  return root;
}

// ---------- Spawning ----------

export function spawnLandmarks(scene, level, playerPos) {
  const group = new THREE.Group();
  group.userData.kind = 'landmarks';

  if (level.harbor) {
    for (let i = 0; i < 5; i++) addAround(group, buildOilRig(), playerPos, 20, 60);
  }
  if (level.military) {
    for (let i = 0; i < 4; i++) addAround(group, buildRadarDish(), playerPos, 18, 60);
  }
  if (level.powerPlant) {
    for (let i = 0; i < 4; i++) addAround(group, buildCoolingTower(), playerPos, 22, 65);
    for (let i = 0; i < 5; i++) addAround(group, buildReactorCore(), playerPos, 14, 50);
  }
  if (level.lavaThrone) {
    for (let i = 0; i < 8; i++) addAround(group, buildLavaPool(), playerPos, 10, 75);
  }

  scene.add(group);
  return group;
}

function addAround(group, mesh, playerPos, minDist, maxDist) {
  for (let tries = 0; tries < 10; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = playerPos.x + Math.cos(ang) * dist;
    const z = playerPos.z + Math.sin(ang) * dist;
    if (Math.abs(x) > PLAYABLE_RADIUS - 5 || Math.abs(z) > PLAYABLE_RADIUS - 5) continue;
    mesh.position.set(x, getHeightAt(x, z), z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    group.add(mesh);
    return;
  }
}

// ---------- Per-frame update ----------

export function updateLandmarks(group, dt, playerPos) {
  if (!group) return;
  for (const obj of group.children) {
    if (obj.userData.kind === 'reactor' && obj.userData.rod) {
      // Pulse glow
      obj.userData.rod.material.emissiveIntensity =
        1.2 + Math.sin(performance.now() * 0.005) * 0.5;
      obj.rotation.y += dt * 0.3;
    } else if (obj.userData.subtype === 'radar' && obj.userData.dish) {
      obj.userData.dish.rotation.z += dt * 0.4;
    }
  }
}
