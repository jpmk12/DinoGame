import * as THREE from 'three';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';

// Destructible city buildings. Big enough dinos topple them; smaller dinos
// are blocked by them (they act as obstacles). Toppling is animated: the
// building tips over around its base, throws rubble, then sinks and fades.

// Building palettes: wall / window-lit / window-dark / roof colors.
const PALETTES = [
  { wall: '#5a5f68', lit: '#ffe9a8', dark: '#2a3038', roof: 0x3a3f46 },
  { wall: '#7a6a52', lit: '#ffe9a8', dark: '#3a3026', roof: 0x4a3f30 },
  { wall: '#3f5a78', lit: '#bfe6ff', dark: '#1f2f44', roof: 0x2a3f55 },
  { wall: '#6a4a42', lit: '#ffd9a0', dark: '#3a2420', roof: 0x4a2f28 },
  { wall: '#737880', lit: '#cfe9ff', dark: '#30363f', roof: 0x44494f },
];

function makeWindowTexture(p) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
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
  return t;
}

export function buildBuilding() {
  const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const w = 4 + Math.random() * 4;
  const d = 4 + Math.random() * 4;
  const h = 6 + Math.random() * 16;

  const tex = makeWindowTexture(p);
  tex.repeat.set(Math.max(1, Math.round(w / 2.5)), Math.max(2, Math.round(h / 3)));
  const winMat = new THREE.MeshLambertMaterial({ map: tex });
  const roofMat = new THREE.MeshLambertMaterial({ color: p.roof });
  // BoxGeometry material order: +x, -x, +y(top), -y(bottom), +z, -z
  const mats = [winMat, winMat, roofMat, roofMat, winMat, winMat];

  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  box.position.y = h / 2; // bottom sits on the group origin
  box.castShadow = true;
  box.receiveShadow = true;

  const root = new THREE.Group();
  root.add(box);

  // Rooftop detail — a small water tank / AC unit
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
  root.userData.toughness = 0.5 + (h / 22) * 1.0;   // taller = needs a bigger dino
  root.userData.score = Math.round(10 + h * 2);
  root.userData.falling = false;
  return root;
}

export function spawnCity(scene, playerPos) {
  const group = new THREE.Group();
  scene.add(group);
  const spacing = 15;
  const blocks = 6;
  for (let gx = -blocks; gx <= blocks; gx++) {
    for (let gz = -blocks; gz <= blocks; gz++) {
      const x = gx * spacing + (Math.random() - 0.5) * 4;
      const z = gz * spacing + (Math.random() - 0.5) * 4;
      if (Math.hypot(x, z) < 12) continue;          // open plaza at spawn
      if (Math.hypot(x, z) > PLAYABLE_RADIUS - 6) continue;
      if (Math.random() < 0.28) continue;           // gaps for streets/parks
      const b = buildBuilding();
      b.position.set(x, getHeightAt(x, z), z);
      b.rotation.y = (Math.floor(Math.random() * 4)) * (Math.PI / 2);
      group.add(b);
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
  // Axis perpendicular to the fall direction so the top tips toward (dx,dz)
  building.userData.fallAxis = new THREE.Vector3(dz, 0, -dx).normalize();
  building.userData.fallAngle = 0;
  building.userData.fallSpeed = 0.4;
  building.userData.restTimer = 0;
  building.userData.falling = true;
}

// Advance toppling animations. Calls particles.rubble(...) for dust/debris.
export function animateBuildings(group, dt, particles) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const b = group.children[i];
    const u = b.userData;
    if (!u.falling) continue;

    if (u.fallAngle < Math.PI / 2) {
      u.fallSpeed += dt * 5;            // gravity-ish angular acceleration
      u.fallAngle = Math.min(Math.PI / 2, u.fallAngle + u.fallSpeed * dt);
      b.quaternion.setFromAxisAngle(u.fallAxis, u.fallAngle);
      if (Math.random() < 0.4 && particles) {
        particles.rubble(b.position, u.radius);
      }
    } else {
      // Flattened — sink into the ground and fade, then remove
      u.restTimer += dt;
      b.position.y -= dt * 1.5;
      if (u.restTimer > 1.8) {
        group.remove(b);
      }
    }
  }
}
