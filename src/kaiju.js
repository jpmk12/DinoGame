import * as THREE from 'three';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';
import { buildTitan } from './dinos.js';

// Phase E: rival kaiju. Huge enemy creatures that wander the map,
// chase the player slowly, drop big rewards (score + Atomic Charge +
// growth) when killed. Each has a unique silhouette so the dinosaur-
// only roster doesn't dominate the encounters.

const FLAT = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FLAT(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- E1. Mecha Titan ----------

export function buildMechaTitan() {
  // Reuse the Titan procedural mesh but recolored chrome + red, and
  // wrap it with a shield sphere we toggle on a timer.
  const mesh = buildTitan(0x8a98a8);
  mesh.scale.setScalar(1.4);
  // Recolor the dorsal plates red
  const plates = mesh.userData.parts.plates;
  if (plates && plates[0]) {
    plates[0].material = plates[0].material.clone();
    plates[0].material.color.setHex(0xff3a2a);
    plates[0].material.emissive.setHex(0xff5a3a);
    plates[0].material.emissiveIntensity = 1.4;
  }
  // Add a shield sphere (toggled invisible/visible by update tick)
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(3.0, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0x66e6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  shield.position.y = 2.0;
  mesh.add(shield);

  mesh.userData.kind = 'kaiju';
  mesh.userData.kaijuType = 'mecha';
  mesh.userData.shield = shield;
  mesh.userData.shieldPhase = Math.random() * 5;
  mesh.userData.shieldOn = false;
  mesh.userData.size = 4.5;
  mesh.userData.score = 250;
  mesh.userData.nutrition = 18;
  mesh.userData.atomicCharge = 30;
  mesh.userData.speed = 3.0;
  mesh.userData.touchCooldown = 0;
  return mesh;
}

// ---------- E2. Giant Crab ----------

export function buildGiantCrab() {
  const root = new THREE.Group();
  const shell = 0xa83a3a;
  const accent = 0x6a1a1a;
  const cream = 0xeac4a8;
  // Dome body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 14, 10),
    FLAT(shell)
  );
  body.scale.set(1.0, 0.55, 1.0);
  body.position.y = 1.0;
  body.castShadow = true;
  root.add(body);
  // Belly
  const belly = box(2.2, 0.4, 1.6, cream);
  belly.position.y = 0.6;
  root.add(belly);
  // Stalk eyes
  for (const x of [-0.45, 0.45]) {
    const stalk = box(0.08, 0.4, 0.08, shell);
    stalk.position.set(x, 1.65, -0.7);
    root.add(stalk);
    const eyeball = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      FLAT(0xffffff)
    );
    eyeball.position.set(x, 1.9, -0.7);
    root.add(eyeball);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 5),
      FLAT(0x000000)
    );
    pupil.position.set(x, 1.92, -0.78);
    root.add(pupil);
  }
  // Mandibles
  const mandL = box(0.18, 0.18, 0.5, accent);
  mandL.position.set(-0.18, 1.0, -1.0);
  mandL.rotation.y = 0.5;
  root.add(mandL);
  const mandR = box(0.18, 0.18, 0.5, accent);
  mandR.position.set(0.18, 1.0, -1.0);
  mandR.rotation.y = -0.5;
  root.add(mandR);
  // Two big claws — held out front
  const claws = [];
  for (const side of [-1, 1]) {
    const armUpper = box(0.35, 0.3, 1.2, shell);
    armUpper.position.set(side * 1.3, 1.05, -0.5);
    armUpper.rotation.y = side * 0.3;
    root.add(armUpper);
    const armLower = box(0.3, 0.3, 1.0, shell);
    armLower.position.set(side * 1.8, 1.05, -1.4);
    armLower.rotation.y = side * 0.5;
    root.add(armLower);
    const clawHub = new THREE.Group();
    clawHub.position.set(side * 2.15, 1.05, -2.0);
    const clawTop = box(0.55, 0.18, 0.7, shell);
    clawTop.position.set(side * 0.05, 0.16, -0.2);
    clawTop.rotation.y = side * 0.2;
    clawHub.add(clawTop);
    const clawBot = box(0.55, 0.18, 0.7, accent);
    clawBot.position.set(side * 0.05, -0.16, -0.2);
    clawBot.rotation.y = side * 0.2;
    clawHub.add(clawBot);
    root.add(clawHub);
    claws.push(clawHub);
  }
  // 8 legs (4 on each side) — animated
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -0.6 + i * 0.4;
      const leg = new THREE.Group();
      leg.position.set(side * 1.05, 0.85, z);
      const upper = box(0.13, 0.13, 0.7, shell);
      upper.rotation.z = side * Math.PI / 4;
      upper.position.set(side * 0.25, -0.05, 0);
      leg.add(upper);
      const lower = box(0.1, 0.1, 0.7, shell);
      lower.rotation.z = side * Math.PI / 2.4;
      lower.position.set(side * 0.6, -0.45, 0);
      leg.add(lower);
      root.add(leg);
      legs.push(leg);
    }
  }

  root.userData.kind = 'kaiju';
  root.userData.kaijuType = 'crab';
  root.userData.legs = legs;
  root.userData.claws = claws;
  root.userData.size = 4.0;
  root.userData.score = 180;
  root.userData.nutrition = 14;
  root.userData.atomicCharge = 22;
  root.userData.speed = 2.6;
  root.userData.walkPhase = Math.random() * Math.PI * 2;
  root.userData.touchCooldown = 0;
  return root;
}

// ---------- E3. Giant Moth ----------

export function buildGiantMoth() {
  const root = new THREE.Group();
  const body = 0xc4a050;
  const wingA = 0xeed8a0;
  const wingB = 0xa07840;
  // Cone fuzzy body
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.35, 1.6, 10),
    FLAT(body)
  );
  torso.rotation.x = Math.PI / 2;
  torso.castShadow = true;
  root.add(torso);
  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    FLAT(body)
  );
  head.position.set(0, 0.05, -0.9);
  root.add(head);
  // Big eyes
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      FLAT(0x222233)
    );
    eye.position.set(x, 0.1, -1.18);
    root.add(eye);
  }
  // Feathery antennae
  for (const x of [-0.18, 0.18]) {
    const ant = box(0.04, 0.7, 0.04, 0x442211);
    ant.position.set(x, 0.45, -1.0);
    ant.rotation.z = x > 0 ? -0.3 : 0.3;
    root.add(ant);
  }
  // Wings — 4 plates (2 fore, 2 hind)
  const wingMatA = new THREE.MeshLambertMaterial({
    color: wingA, side: THREE.DoubleSide, flatShading: true,
  });
  const wingMatB = new THREE.MeshLambertMaterial({
    color: wingB, side: THREE.DoubleSide, flatShading: true,
  });
  const wings = [];
  const makeWing = (sx, sz, mat, w, h) => {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    wing.position.set(sx, 0.1, sz);
    wing.castShadow = true;
    root.add(wing);
    return wing;
  };
  const wingFL = makeWing(-1.6, -0.2, wingMatA, 2.8, 1.6);
  const wingFR = makeWing(1.6, -0.2, wingMatA, 2.8, 1.6);
  const wingHL = makeWing(-1.3, 0.6, wingMatB, 2.0, 1.2);
  const wingHR = makeWing(1.3, 0.6, wingMatB, 2.0, 1.2);
  wings.push(wingFL, wingFR, wingHL, wingHR);

  root.position.y = 14;

  root.userData.kind = 'kaiju';
  root.userData.kaijuType = 'moth';
  root.userData.wings = wings;
  root.userData.flying = true;
  root.userData.flyHeight = 14;
  root.userData.size = 4.0;
  root.userData.score = 160;
  root.userData.nutrition = 12;
  root.userData.atomicCharge = 18;
  root.userData.speed = 4.0;
  root.userData.wingPhase = Math.random() * Math.PI * 2;
  root.userData.orbitAngle = Math.random() * Math.PI * 2;
  root.userData.orbitRadius = 24 + Math.random() * 10;
  root.userData.larvaTimer = 6 + Math.random() * 4;
  return root;
}

// ---------- E4. Giant Scorpion ----------

export function buildGiantScorpion() {
  const root = new THREE.Group();
  const carapace = 0x6a3a24;
  const accent = 0x3a1a0a;
  const sting = 0xe0c878;
  // Segmented body (3 segments)
  for (let i = 0; i < 3; i++) {
    const w = 1.5 - i * 0.18;
    const seg = box(w, 0.55, 0.7, carapace);
    seg.position.set(0, 0.85, -0.4 + i * 0.7);
    root.add(seg);
  }
  // Head + mandibles
  const head = box(1.2, 0.5, 0.7, carapace);
  head.position.set(0, 0.85, -1.2);
  root.add(head);
  for (const side of [-1, 1]) {
    const mand = box(0.18, 0.2, 0.4, accent);
    mand.position.set(side * 0.3, 0.85, -1.65);
    root.add(mand);
  }
  // Eyes (cluster of 4 small)
  for (const x of [-0.18, 0.18]) {
    for (const yo of [0, 0.15]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 5),
        FLAT(0xff0000)
      );
      eye.position.set(x, 1.05 + yo, -1.45);
      root.add(eye);
    }
  }
  // Big claws (pincers) extending forward
  const claws = [];
  for (const side of [-1, 1]) {
    const armUpper = box(0.3, 0.35, 0.9, carapace);
    armUpper.position.set(side * 1.0, 0.85, -1.2);
    root.add(armUpper);
    const armLower = box(0.3, 0.3, 0.7, carapace);
    armLower.position.set(side * 1.4, 0.85, -1.9);
    root.add(armLower);
    const clawHub = new THREE.Group();
    clawHub.position.set(side * 1.55, 0.85, -2.45);
    const pT = box(0.45, 0.16, 0.55, carapace);
    pT.position.y = 0.1;
    clawHub.add(pT);
    const pB = box(0.45, 0.16, 0.55, accent);
    pB.position.y = -0.1;
    clawHub.add(pB);
    root.add(clawHub);
    claws.push(clawHub);
  }
  // Tail (5 segments arcing up and over)
  const tail = new THREE.Group();
  let segY = 1.05, segZ = 1.5;
  let segRotX = 0.3;
  const tailSegs = [];
  for (let i = 0; i < 6; i++) {
    const w = 0.45 - i * 0.05;
    const seg = box(w, w, 0.4, carapace);
    seg.position.set(0, segY, segZ);
    seg.rotation.x = segRotX;
    root.add(seg);
    tailSegs.push(seg);
    segY += 0.3 + i * 0.07;
    segZ += 0.18 - i * 0.02;
    segRotX += 0.2;
  }
  // Stinger
  const stinger = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.55, 6),
    FLAT(sting)
  );
  stinger.position.set(0, segY + 0.18, segZ);
  stinger.rotation.x = -0.9;
  stinger.castShadow = true;
  root.add(stinger);
  // 8 legs
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -0.5 + i * 0.45;
      const leg = new THREE.Group();
      leg.position.set(side * 0.7, 0.7, z);
      const upper = box(0.13, 0.12, 0.55, carapace);
      upper.rotation.z = side * Math.PI / 4;
      upper.position.set(side * 0.18, -0.1, 0);
      leg.add(upper);
      const lower = box(0.1, 0.1, 0.55, carapace);
      lower.rotation.z = side * Math.PI / 2.4;
      lower.position.set(side * 0.45, -0.45, 0);
      leg.add(lower);
      root.add(leg);
      legs.push(leg);
    }
  }

  root.userData.kind = 'kaiju';
  root.userData.kaijuType = 'scorpion';
  root.userData.legs = legs;
  root.userData.claws = claws;
  root.userData.tailSegs = tailSegs;
  root.userData.stinger = stinger;
  root.userData.size = 4.5;
  root.userData.score = 200;
  root.userData.nutrition = 16;
  root.userData.atomicCharge = 25;
  root.userData.speed = 3.4;
  root.userData.walkPhase = Math.random() * Math.PI * 2;
  root.userData.touchCooldown = 0;
  return root;
}

// ---------- Spawning ----------

export function spawnKaiju(scene, playerPos, counts = {}) {
  const group = new THREE.Group();
  group.userData.kind = 'kaiju';
  const nMecha    = counts.mecha    ?? 0;
  const nCrab     = counts.crab     ?? 0;
  const nMoth     = counts.moth     ?? 0;
  const nScorpion = counts.scorpion ?? 0;

  for (let i = 0; i < nMecha; i++) addAround(group, buildMechaTitan(), playerPos);
  for (let i = 0; i < nCrab; i++) addAround(group, buildGiantCrab(), playerPos);
  for (let i = 0; i < nMoth; i++) {
    const m = buildGiantMoth();
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 20;
    m.position.set(
      playerPos.x + Math.cos(ang) * dist,
      m.userData.flyHeight,
      playerPos.z + Math.sin(ang) * dist
    );
    group.add(m);
  }
  for (let i = 0; i < nScorpion; i++) addAround(group, buildGiantScorpion(), playerPos);

  scene.add(group);
  return group;
}

function addAround(group, mesh, playerPos) {
  for (let tries = 0; tries < 10; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * 25;
    const x = playerPos.x + Math.cos(ang) * dist;
    const z = playerPos.z + Math.sin(ang) * dist;
    if (Math.abs(x) > PLAYABLE_RADIUS - 5 || Math.abs(z) > PLAYABLE_RADIUS - 5) continue;
    mesh.position.set(x, mesh.userData.flying ? mesh.userData.flyHeight : getHeightAt(x, z), z);
    group.add(mesh);
    return;
  }
}

// ---------- Per-frame update ----------

const _tmp = new THREE.Vector3();

export function updateKaiju(group, dt, playerPos, onTouch, spawnLarvaCb) {
  if (!group) return;
  for (const ent of group.children) {
    const t = ent.userData.kaijuType;
    if (t === 'mecha')    updateMecha(ent, dt, playerPos, onTouch);
    else if (t === 'crab')     updateCrab(ent, dt, playerPos, onTouch);
    else if (t === 'moth')     updateMoth(ent, dt, playerPos, spawnLarvaCb);
    else if (t === 'scorpion') updateScorpion(ent, dt, playerPos, onTouch);
  }
}

function commonChase(ent, dt, playerPos) {
  const u = ent.userData;
  const dx = playerPos.x - ent.position.x;
  const dz = playerPos.z - ent.position.z;
  const dist = Math.hypot(dx, dz) || 1;
  if (dist > 6) {
    ent.position.x += (dx / dist) * u.speed * dt;
    ent.position.z += (dz / dist) * u.speed * dt;
  }
  ent.rotation.y = Math.atan2(-dx, -dz);
  if (!u.flying) ent.position.y = getHeightAt(ent.position.x, ent.position.z);
  const lim = PLAYABLE_RADIUS - 4;
  ent.position.x = Math.max(-lim, Math.min(lim, ent.position.x));
  ent.position.z = Math.max(-lim, Math.min(lim, ent.position.z));
  return dist;
}

function maybeTouch(ent, dist, onTouch) {
  const u = ent.userData;
  u.touchCooldown = Math.max(0, (u.touchCooldown || 0) - 1 / 60); // approximate
  if (dist < (u.size || 3) * 0.6 && u.touchCooldown <= 0) {
    u.touchCooldown = 1.0;
    onTouch && onTouch(ent);
  }
}

function updateMecha(ent, dt, playerPos, onTouch) {
  const u = ent.userData;
  // Shield cycle: 6s off, 2s on
  u.shieldPhase += dt;
  const cyc = u.shieldPhase % 8;
  const wantShield = cyc > 6;
  if (wantShield && !u.shieldOn) {
    u.shieldOn = true;
    u.shield.material.opacity = 0.45;
  } else if (!wantShield && u.shieldOn) {
    u.shieldOn = false;
    u.shield.material.opacity = 0;
  }
  if (u.shieldOn) {
    u.shield.material.opacity = 0.3 + Math.sin(performance.now() * 0.01) * 0.18;
    u.shield.rotation.y += dt * 1.5;
  }
  const dist = commonChase(ent, dt, playerPos);
  maybeTouch(ent, dist, onTouch);
}

function updateCrab(ent, dt, playerPos, onTouch) {
  const u = ent.userData;
  u.walkPhase += dt * 6;
  // Animate legs in two alternating sets
  for (let i = 0; i < u.legs.length; i++) {
    const phase = u.walkPhase + (i % 2) * Math.PI;
    u.legs[i].rotation.x = Math.sin(phase) * 0.4;
  }
  // Claws pinch open/closed
  for (const c of u.claws) c.rotation.x = Math.sin(u.walkPhase * 0.7) * 0.18;
  const dist = commonChase(ent, dt, playerPos);
  maybeTouch(ent, dist, onTouch);
}

function updateMoth(ent, dt, playerPos, spawnLarvaCb) {
  const u = ent.userData;
  u.wingPhase += dt * 6;
  for (const w of u.wings) w.rotation.z = Math.sin(u.wingPhase) * 0.7;
  // Orbit the player at altitude
  u.orbitAngle += dt * 0.35;
  const targetX = playerPos.x + Math.cos(u.orbitAngle) * u.orbitRadius;
  const targetZ = playerPos.z + Math.sin(u.orbitAngle) * u.orbitRadius;
  ent.position.x += (targetX - ent.position.x) * Math.min(1, dt * 0.7);
  ent.position.z += (targetZ - ent.position.z) * Math.min(1, dt * 0.7);
  ent.position.y = u.flyHeight + Math.sin(u.wingPhase * 0.3) * 0.6;
  ent.rotation.y = Math.atan2(-(targetX - ent.position.x), -(targetZ - ent.position.z));
  // Drop larvae periodically
  u.larvaTimer -= dt;
  if (u.larvaTimer <= 0) {
    u.larvaTimer = 8 + Math.random() * 5;
    spawnLarvaCb && spawnLarvaCb(ent.position.clone());
  }
}

function updateScorpion(ent, dt, playerPos, onTouch) {
  const u = ent.userData;
  u.walkPhase += dt * 7;
  // Skitter legs
  for (let i = 0; i < u.legs.length; i++) {
    const phase = u.walkPhase + (i % 2) * Math.PI;
    u.legs[i].rotation.x = Math.sin(phase) * 0.5;
  }
  // Tail oscillation (intimidating idle wave)
  for (let i = 0; i < u.tailSegs.length; i++) {
    u.tailSegs[i].rotation.y = Math.sin(u.walkPhase * 0.5 + i * 0.4) * 0.08;
  }
  u.stinger.rotation.y = Math.sin(u.walkPhase * 0.5 + u.tailSegs.length * 0.4) * 0.08;
  const dist = commonChase(ent, dt, playerPos);
  maybeTouch(ent, dist, onTouch);
}

// Mecha shield blocks AOE — exported helper for consume paths
export function kaijuBlocksAOE(ent) {
  return ent.userData.kaijuType === 'mecha' && ent.userData.shieldOn;
}
