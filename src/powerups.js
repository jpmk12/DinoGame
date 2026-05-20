import * as THREE from 'three';
import { WORLD_SIZE, getHeightAt } from './world.js';

// Glowing berries with three flavors. Each grants a temporary buff.

export const POWERUP_TYPES = {
  speed: {
    name: 'Speed Boost',
    color: 0xffcc44,
    duration: 10,
    icon: '⚡',
    desc: '2x speed',
  },
  growth: {
    name: 'Growth Spurt',
    color: 0xff5599,
    duration: 12,
    icon: '🌱',
    desc: 'x2 food value',
  },
  apex: {
    name: 'Apex Predator',
    color: 0xaa44ff,
    duration: 10,
    icon: '⭐',
    desc: 'Eat anything',
  },
};

const TYPES = Object.keys(POWERUP_TYPES);

export function buildBerry(type) {
  const root = new THREE.Group();
  const info = POWERUP_TYPES[type];

  // Core fruit
  const berry = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 12),
    new THREE.MeshLambertMaterial({
      color: info.color,
      emissive: info.color,
      emissiveIntensity: 0.6,
    })
  );
  berry.castShadow = true;
  berry.position.y = 0.6;
  root.add(berry);

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a5a2a })
  );
  stem.position.y = 1.0;
  root.add(stem);

  // Leaf
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.04, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x4aa050 })
  );
  leaf.position.set(0.08, 1.02, 0);
  leaf.rotation.z = -0.4;
  root.add(leaf);

  // Halo (additive glow)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 14, 10),
    new THREE.MeshBasicMaterial({
      color: info.color,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
  );
  halo.position.y = 0.6;
  root.add(halo);

  root.userData.kind = 'berry';
  root.userData.berryType = type;
  root.userData.halo = halo;
  root.userData.berryMesh = berry;
  root.userData.bobPhase = Math.random() * Math.PI * 2;
  return root;
}

function placeRandom(obj, playerPos, minDist = 14) {
  for (let tries = 0; tries < 25; tries++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    if (Math.hypot(x - playerPos.x, z - playerPos.z) > minDist) {
      obj.position.set(x, getHeightAt(x, z), z);
      return;
    }
  }
  const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  obj.position.set(x, getHeightAt(x, z), z);
}

export function spawnBerries(scene, playerPos, count = 5) {
  const group = new THREE.Group();
  scene.add(group);
  for (let i = 0; i < count; i++) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const b = buildBerry(type);
    placeRandom(b, playerPos, 18);
    group.add(b);
  }
  return group;
}

export function spawnBerry(group, playerPos) {
  const type = TYPES[Math.floor(Math.random() * TYPES.length)];
  const b = buildBerry(type);
  placeRandom(b, playerPos, 18);
  group.add(b);
  return b;
}

// Animate berries: gentle bob + pulsing halo.
export function animateBerries(group, dt, totalTime) {
  for (const b of group.children) {
    b.userData.bobPhase += dt * 2;
    const ph = b.userData.bobPhase;
    if (b.userData.berryMesh) {
      b.userData.berryMesh.position.y = 0.6 + Math.sin(ph) * 0.12;
      b.userData.berryMesh.rotation.y = ph * 0.5;
    }
    if (b.userData.halo) {
      const s = 1 + Math.sin(ph * 1.5) * 0.15;
      b.userData.halo.scale.setScalar(s);
      b.userData.halo.material.opacity = 0.18 + Math.sin(ph * 1.5) * 0.1;
    }
  }
}
