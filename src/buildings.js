import * as THREE from 'three';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';
import { buildTree } from './dinos.js';
import { getLevel } from './levels.js';

// A real-feeling city: a street grid of blocks separated by roads, with
// building blocks, parks, and an open plaza at spawn. Big dinos topple
// buildings (animated); small dinos are blocked by them.

// Street grid geometry — exported so the car AI can follow the roads.
export const CELL = 32;          // road-to-road pitch
export const ROAD = 11;          // street width
const BLOCK = CELL - ROAD;       // usable block interior (~21)

const ASPHALT = 0x33363d;
const SIDEWALK = 0x6f727a;
const PLAZA = 0x7d808a;
const GRASS = 0x4a8a44;
const LANE = 0xd9c24a;

// ----- Window-texture pool (one per palette, cloned per building) -----
const PALETTES = [
  { wall: '#5a5f68', lit: '#ffe9a8', dark: '#2a3038', roof: 0x3a3f46 },
  { wall: '#7a6a52', lit: '#ffe9a8', dark: '#3a3026', roof: 0x4a3f30 },
  { wall: '#3f5a78', lit: '#bfe6ff', dark: '#1f2f44', roof: 0x2a3f55 },
  { wall: '#6a4a42', lit: '#ffd9a0', dark: '#3a2420', roof: 0x4a2f28 },
  { wall: '#737880', lit: '#cfe9ff', dark: '#30363f', roof: 0x44494f },
];

function baseWindowTexture(p) {
  if (p._tex) return p._tex;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = p.wall;
  ctx.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 3; x++) {
      ctx.fillStyle = Math.random() < 0.5 ? p.lit : p.dark;
      ctx.fillRect(4 + x * 9, 3 + y * 7, 6, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  p._tex = t;
  return t;
}

export function buildBuilding(opts = {}) {
  const {
    minW = 4, maxW = 8, minD = 4, maxD = 8, minH = 6, maxH = 22,
    glowingWindows = false,
  } = opts;
  const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const w = minW + Math.random() * (maxW - minW);
  const d = minD + Math.random() * (maxD - minD);
  const h = minH + Math.random() * (maxH - minH);

  const tex = baseWindowTexture(p).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 2.5)), Math.max(2, Math.round(h / 3)));
  const winMat = glowingWindows
    ? new THREE.MeshLambertMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 1.2, // bright enough to bloom
      })
    : new THREE.MeshLambertMaterial({ map: tex });
  const roofMat = new THREE.MeshLambertMaterial({ color: p.roof });
  const mats = [winMat, winMat, roofMat, roofMat, winMat, winMat];

  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  box.position.y = h / 2;
  box.castShadow = true;
  box.receiveShadow = true;

  const root = new THREE.Group();
  root.add(box);

  const detail = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.35, 0.8, d * 0.35),
    roofMat
  );
  detail.position.set((Math.random() - 0.5) * w * 0.3, h + 0.4, (Math.random() - 0.5) * d * 0.3);
  detail.castShadow = true;
  root.add(detail);

  root.userData.kind = 'building';
  root.userData.height = h;
  root.userData.radius = Math.max(w, d) * 0.5;
  root.userData.toughness = 0.5 + (h / 22) * 1.0;
  root.userData.score = Math.round(10 + h * 2);
  root.userData.falling = false;
  return root;
}

// ----- Flat ground pieces -----
function flatTile(w, d, color, y = 0.03) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

let _dashTex = null;
function dashTexture() {
  if (_dashTex) return _dashTex;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 16;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 4, 16);
  ctx.fillStyle = '#d9c24a';
  ctx.fillRect(1, 2, 2, 9); // dash with a gap above/below
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  _dashTex = t;
  return t;
}

function buildStreets(group, half) {
  // Base asphalt covering the whole play area; block tiles laid on top
  // leave road-width gaps that read as streets.
  const base = flatTile(half * 2 + CELL, half * 2 + CELL, ASPHALT, 0.01);
  group.add(base);

  // Dashed center-line per road line — one textured plane each (cheap).
  const maxK = Math.ceil(half / CELL);
  const len = half * 2;
  const dashes = Math.round(len / 5);
  for (let k = -maxK; k <= maxK; k++) {
    const c = k * CELL;
    if (Math.abs(c) > half) continue;

    const texV = dashTexture().clone();
    texV.needsUpdate = true;
    texV.repeat.set(1, dashes);
    const lineV = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, len),
      new THREE.MeshBasicMaterial({ map: texV, transparent: true })
    );
    lineV.rotation.x = -Math.PI / 2;
    lineV.position.set(c, 0.05, 0);
    group.add(lineV);

    const texH = dashTexture().clone();
    texH.needsUpdate = true;
    texH.repeat.set(1, dashes);
    const lineH = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, len),
      new THREE.MeshBasicMaterial({ map: texH, transparent: true })
    );
    lineH.rotation.x = -Math.PI / 2;
    lineH.rotation.z = Math.PI / 2;
    lineH.position.set(0, 0.05, c);
    group.add(lineH);
  }
}

function addBuildingBlock(group, cx, cz, glow) {
  const lot = flatTile(BLOCK, BLOCK, SIDEWALK);
  lot.position.set(cx, 0.03, cz);
  group.add(lot);

  if (Math.random() < 0.28) {
    // One tower filling most of the block
    const b = buildBuilding({
      minW: 11, maxW: 15, minD: 11, maxD: 15, minH: 14, maxH: 26,
      glowingWindows: glow,
    });
    b.position.set(cx, 0, cz);
    b.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
    group.add(b);
    return;
  }

  const off = BLOCK / 4;
  for (const sx of [-off, off]) {
    for (const sz of [-off, off]) {
      if (Math.random() < 0.18) continue;
      const b = buildBuilding({
        minW: 6, maxW: 9, minD: 6, maxD: 9, minH: 6, maxH: 18,
        glowingWindows: glow,
      });
      b.position.set(
        cx + sx + (Math.random() - 0.5) * 1.2,
        0,
        cz + sz + (Math.random() - 0.5) * 1.2
      );
      b.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
      group.add(b);
    }
  }
}

function addPark(group, cx, cz) {
  const lot = flatTile(BLOCK, BLOCK, GRASS);
  lot.position.set(cx, 0.03, cz);
  group.add(lot);

  // A pond in some parks
  if (Math.random() < 0.4) {
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(3 + Math.random() * 2, 18),
      new THREE.MeshLambertMaterial({ color: 0x3a6abf })
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(cx, 0.05, cz);
    group.add(pond);
  }

  // Trees scattered in the park (decoration, not destructible)
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const t = buildTree();
    t.position.set(
      cx + (Math.random() - 0.5) * BLOCK * 0.8,
      0,
      cz + (Math.random() - 0.5) * BLOCK * 0.8
    );
    t.scale.setScalar(0.6 + Math.random() * 0.5);
    t.userData.kind = 'decor';
    group.add(t);
  }
}

function addPlaza(group, cx, cz) {
  const lot = flatTile(BLOCK, BLOCK, PLAZA);
  lot.position.set(cx, 0.03, cz);
  group.add(lot);
}

export function spawnCity(scene, playerPos) {
  const group = new THREE.Group();
  scene.add(group);
  const half = PLAYABLE_RADIUS - 4;
  const level = getLevel();
  const glow = !!level.nightCity;

  buildStreets(group, half);

  const maxK = Math.floor(half / CELL);
  for (let kx = -maxK; kx < maxK; kx++) {
    for (let kz = -maxK; kz < maxK; kz++) {
      const cx = kx * CELL + CELL / 2;
      const cz = kz * CELL + CELL / 2;
      if (Math.hypot(cx, cz) > half - BLOCK / 2) continue;
      if (Math.hypot(cx, cz) < CELL * 1.2) {
        addPlaza(group, cx, cz);
      } else if (Math.random() < 0.18) {
        addPark(group, cx, cz);
      } else {
        addBuildingBlock(group, cx, cz, glow);
      }
    }
  }
  return group;
}

// Begin toppling a building away from the given source point (the player).
export function topple(building, fromX, fromZ) {
  if (building.userData.falling) return;
  let dx = building.position.x - fromX;
  let dz = building.position.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  building.userData.fallAxis = new THREE.Vector3(dz, 0, -dx).normalize();
  building.userData.fallAngle = 0;
  building.userData.fallSpeed = 0.4;
  building.userData.restTimer = 0;
  building.userData.falling = true;
}

export function animateBuildings(group, dt, particles) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const b = group.children[i];
    const u = b.userData;
    if (!u || !u.falling) continue;

    if (u.fallAngle < Math.PI / 2) {
      u.fallSpeed += dt * 5;
      u.fallAngle = Math.min(Math.PI / 2, u.fallAngle + u.fallSpeed * dt);
      b.quaternion.setFromAxisAngle(u.fallAxis, u.fallAngle);
      if (Math.random() < 0.4 && particles) particles.rubble(b.position, u.radius);
    } else {
      u.restTimer += dt;
      b.position.y -= dt * 1.5;
      if (u.restTimer > 1.8) group.remove(b);
    }
  }
}
