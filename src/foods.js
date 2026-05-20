import * as THREE from 'three';
import { WORLD_SIZE, biomeAt, getHeightAt } from './world.js';

// ---------- Mesh builders ----------

const FLAT = (c) => new THREE.MeshLambertMaterial({ color: c });

function spotted(mat, baseColor) {
  // Helper: a dome with white spots for mushroom caps.
  return mat;
}

/**
 * Mushroom — forest biome, cluster of 1-3.
 */
export function buildMushroom() {
  const root = new THREE.Group();
  const capColors = [0xcc4444, 0xddaa44, 0xaa44cc, 0xee8844];
  const capColor = capColors[Math.floor(Math.random() * capColors.length)];

  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Group();
    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.35, 8),
      FLAT(0xf0e8d0)
    );
    stem.position.y = 0.18;
    stem.castShadow = true;
    m.add(stem);
    // Cap
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      FLAT(capColor)
    );
    cap.position.y = 0.38;
    cap.scale.y = 0.7;
    cap.castShadow = true;
    m.add(cap);
    // White spots on the cap
    for (let s = 0; s < 4; s++) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 5),
        FLAT(0xfff8e0)
      );
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.15;
      spot.position.set(Math.cos(ang) * r, 0.42, Math.sin(ang) * r);
      m.add(spot);
    }
    // Place each in cluster
    const ang = (i / count) * Math.PI * 2;
    m.position.set(Math.cos(ang) * 0.15 * i, 0, Math.sin(ang) * 0.15 * i);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.scale.setScalar(0.85 + Math.random() * 0.5);
    root.add(m);
  }

  root.userData.kind = 'food';
  root.userData.foodType = 'mushroom';
  root.userData.size = 0.45;
  root.userData.nutrition = 2;
  root.userData.score = 2;
  root.userData.particleType = 'leaves';
  return root;
}

/**
 * Cactus fruit — desert biome, sits on the ground (small clusters).
 */
export function buildCactusFruit() {
  const root = new THREE.Group();
  const colors = [0xee4466, 0xee6644, 0xcc3355];
  const fruitColor = colors[Math.floor(Math.random() * colors.length)];

  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      FLAT(fruitColor)
    );
    fruit.scale.y = 1.2;
    const ang = (i / count) * Math.PI * 2;
    fruit.position.set(
      Math.cos(ang) * 0.18,
      0.25,
      Math.sin(ang) * 0.18
    );
    fruit.castShadow = true;
    root.add(fruit);
    // Little green tuft on top
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.1, 5),
      FLAT(0x4a8a4a)
    );
    tuft.position.copy(fruit.position);
    tuft.position.y += 0.18;
    root.add(tuft);
    // Tiny dark spots (areoles)
    for (let s = 0; s < 4; s++) {
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 5, 4),
        FLAT(0x442222)
      );
      const sa = (s / 4) * Math.PI * 2;
      spot.position.set(
        fruit.position.x + Math.cos(sa) * 0.18,
        fruit.position.y,
        fruit.position.z + Math.sin(sa) * 0.18
      );
      root.add(spot);
    }
  }

  root.userData.kind = 'food';
  root.userData.foodType = 'cactusFruit';
  root.userData.size = 0.55;
  root.userData.nutrition = 3;
  root.userData.score = 4;
  root.userData.particleType = 'meat'; // juicy splat
  return root;
}

/**
 * Watermelon — large rare juicy fruit, any biome.
 */
export function buildWatermelon() {
  const root = new THREE.Group();

  // Striped sphere via stacked thin slices (alternating colors)
  const slices = 8;
  const radius = 0.55;
  for (let i = 0; i < slices; i++) {
    const t0 = (i / slices) * Math.PI - Math.PI / 2;
    const t1 = ((i + 1) / slices) * Math.PI - Math.PI / 2;
    const c = i % 2 === 0 ? 0x2a6a2a : 0x6aa050;
    const slice = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 4, 0, Math.PI * 2, Math.PI / 2 + t0, t1 - t0),
      FLAT(c)
    );
    slice.position.y = 0.55;
    slice.castShadow = true;
    root.add(slice);
  }

  // Stem nub
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.1, 6),
    FLAT(0x3a5a2a)
  );
  stem.position.y = 1.14;
  root.add(stem);

  root.userData.kind = 'food';
  root.userData.foodType = 'watermelon';
  root.userData.size = 0.9;
  root.userData.nutrition = 6;
  root.userData.score = 8;
  root.userData.particleType = 'watermelon'; // special pink splat
  root.userData.bobPhase = Math.random() * Math.PI * 2;
  return root;
}

/**
 * Pinecone — forest biome, plentiful little snack under trees.
 */
export function buildPinecone() {
  const root = new THREE.Group();
  // Stacked rings of scales
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = 0.14 * (1 - t * 0.7);
    const ring = new THREE.Mesh(
      new THREE.ConeGeometry(r, 0.1, 8),
      FLAT(0x6a4422)
    );
    ring.position.y = 0.1 + i * 0.07;
    ring.rotation.y = (i % 2) * 0.4;
    ring.castShadow = true;
    root.add(ring);
  }
  // Pointed top
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.1, 6),
    FLAT(0x5a3a1a)
  );
  top.position.y = 0.5;
  root.add(top);

  root.userData.kind = 'food';
  root.userData.foodType = 'pinecone';
  root.userData.size = 0.3;
  root.userData.nutrition = 1;
  root.userData.score = 1;
  root.userData.particleType = 'leaves';
  return root;
}

/**
 * Beetle — small dark bug that scurries around. Moves like a slow critter.
 */
export function buildBeetle() {
  const root = new THREE.Group();
  const bodyColors = [0x2a2a2a, 0x442a44, 0x224422, 0x442222];
  const c = bodyColors[Math.floor(Math.random() * bodyColors.length)];

  // Shell (oval dome)
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 })
  );
  shell.scale.set(1.2, 0.7, 1.4);
  shell.position.y = 0.12;
  shell.castShadow = true;
  root.add(shell);

  // Shell crack line down the middle
  const crack = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.03, 0.4),
    FLAT(0x111111)
  );
  crack.position.y = 0.22;
  root.add(crack);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    FLAT(c)
  );
  head.position.set(0, 0.12, -0.22);
  head.castShadow = true;
  root.add(head);

  // Antennae
  for (const x of [-0.04, 0.04]) {
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4),
      FLAT(c)
    );
    ant.position.set(x, 0.2, -0.3);
    ant.rotation.x = -0.6;
    root.add(ant);
  }

  // 6 legs (3 per side, small boxes)
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.16),
        FLAT(c)
      );
      leg.position.set(side * 0.15, 0.04, -0.1 + i * 0.12);
      leg.rotation.z = side * 0.3;
      root.add(leg);
    }
  }

  root.userData.kind = 'food';
  root.userData.foodType = 'beetle';
  root.userData.size = 0.32;
  root.userData.nutrition = 1;
  root.userData.score = 2;
  root.userData.particleType = 'meat';
  root.userData.walkPhase = Math.random() * Math.PI * 2;
  root.userData.wanderTimer = 0;
  root.userData.wanderDir = new THREE.Vector3(
    Math.random() - 0.5, 0, Math.random() - 0.5
  ).normalize();
  root.userData.speed = 1.5 + Math.random() * 0.8;
  root.userData.bug = true;
  return root;
}

// ---------- Placement ----------

function placeAt(obj, x, z) {
  obj.position.set(x, getHeightAt(x, z), z);
  obj.rotation.y = Math.random() * Math.PI * 2;
}

function tryRandomInBiome(obj, biome, minDist, playerPos) {
  for (let tries = 0; tries < 30; tries++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    if (biome && biomeAt(x, z) !== biome) continue;
    if (playerPos && Math.hypot(x - playerPos.x, z - playerPos.z) < minDist) continue;
    placeAt(obj, x, z);
    return true;
  }
  // Fallback: place anywhere
  const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  placeAt(obj, x, z);
  return false;
}

const SPAWN_TABLE = [
  { type: 'mushroom',    build: buildMushroom,    biome: 'forest', count: 30 },
  { type: 'pinecone',    build: buildPinecone,    biome: 'forest', count: 40 },
  { type: 'cactusFruit', build: buildCactusFruit, biome: 'desert', count: 20 },
  { type: 'watermelon',  build: buildWatermelon,  biome: null,     count: 8  },
  { type: 'beetle',      build: buildBeetle,      biome: null,     count: 25 },
];

/**
 * Populate the world with all new food types. Returns the group.
 */
export function spawnFoods(scene, playerPos) {
  const group = new THREE.Group();
  scene.add(group);
  for (const entry of SPAWN_TABLE) {
    for (let i = 0; i < entry.count; i++) {
      const food = entry.build();
      tryRandomInBiome(food, entry.biome, 6, playerPos);
      group.add(food);
    }
  }
  return group;
}

/**
 * Respawn a single food. If `foodType` is given, that type; else random
 * weighted by the spawn table.
 */
export function spawnFood(group, playerPos, foodType = null) {
  let entry;
  if (foodType) {
    entry = SPAWN_TABLE.find((e) => e.type === foodType);
  }
  if (!entry) {
    const total = SPAWN_TABLE.reduce((s, e) => s + e.count, 0);
    let r = Math.random() * total;
    for (const e of SPAWN_TABLE) {
      r -= e.count;
      if (r <= 0) {
        entry = e;
        break;
      }
    }
  }
  const food = entry.build();
  tryRandomInBiome(food, entry.biome, 6, playerPos);
  group.add(food);
  return food;
}

/**
 * Animate per-frame: watermelon bobs gently, beetles scurry around.
 */
export function animateFoods(group, dt) {
  for (const f of group.children) {
    const ft = f.userData.foodType;
    if (ft === 'watermelon') {
      f.userData.bobPhase += dt * 1.5;
      // Slight wobble in place — sitting on the ground
      f.rotation.z = Math.sin(f.userData.bobPhase) * 0.05;
    } else if (ft === 'beetle') {
      // Wander behavior
      f.userData.wanderTimer -= dt;
      if (f.userData.wanderTimer <= 0) {
        f.userData.wanderDir.set(
          Math.random() - 0.5, 0, Math.random() - 0.5
        ).normalize();
        f.userData.wanderTimer = 1.5 + Math.random() * 2.5;
      }
      const sp = f.userData.speed;
      f.position.x += f.userData.wanderDir.x * sp * dt;
      f.position.z += f.userData.wanderDir.z * sp * dt;
      f.position.y = getHeightAt(f.position.x, f.position.z);
      f.rotation.y = Math.atan2(-f.userData.wanderDir.x, -f.userData.wanderDir.z);
      // Tiny leg shuffle bob
      f.userData.walkPhase += dt * 14;
      f.position.y += Math.abs(Math.sin(f.userData.walkPhase)) * 0.02;
      // Clamp inside world
      const limit = WORLD_SIZE - 2;
      f.position.x = Math.max(-limit, Math.min(limit, f.position.x));
      f.position.z = Math.max(-limit, Math.min(limit, f.position.z));
    }
  }
}
