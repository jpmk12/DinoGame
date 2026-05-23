import * as THREE from 'three';
import { getHeightAt } from './world.js';

// The player's home base — a big distinctive nest at the spawn point.
// Standing inside it slowly regenerates growth and shows a Home indicator.

export const HOME_RADIUS = 5;       // distance considered "in the nest"
export const HOME_REGEN_RATE = 1;   // growth points per second while inside

const FLAT = (c) => new THREE.MeshLambertMaterial({ color: c });

export function buildHomeNest(scene) {
  const root = new THREE.Group();
  root.position.set(0, getHeightAt(0, 0), 0);

  // Ring of large stones
  const stoneColors = [0x888080, 0x6a6a60, 0x999088, 0x808078];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const r = 3.4 + (i % 2 === 0 ? 0.2 : -0.2);
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.55 + Math.random() * 0.35, 0),
      FLAT(stoneColors[Math.floor(Math.random() * stoneColors.length)])
    );
    stone.position.set(
      Math.cos(ang) * r,
      0.3 + Math.random() * 0.1,
      Math.sin(ang) * r
    );
    stone.rotation.y = Math.random() * Math.PI;
    stone.castShadow = true;
    stone.receiveShadow = true;
    root.add(stone);
  }

  // Soft glowing center pad — slight emissive grass
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.1, 0.18, 24),
    new THREE.MeshLambertMaterial({
      color: 0x6a8a40,
      emissive: 0x405a20,
      emissiveIntensity: 0.6,
    })
  );
  pad.position.y = 0.1;
  pad.receiveShadow = true;
  root.add(pad);

  // Inner softer pad (resting spot)
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.6, 0.12, 16),
    new THREE.MeshLambertMaterial({ color: 0x8aa050 })
  );
  inner.position.y = 0.2;
  root.add(inner);

  // Central totem — wooden post with a stone on top
  const totem = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 1.6, 8),
    FLAT(0x6a4422)
  );
  post.position.y = 0.95;
  post.castShadow = true;
  totem.add(post);
  // Carved markings (stacked horizontal bars)
  for (let i = 0; i < 3; i++) {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 0.28),
      FLAT(0x3a2a14)
    );
    mark.position.y = 0.4 + i * 0.4;
    totem.add(mark);
  }
  // Stone hat
  const hat = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.28, 0),
    FLAT(0x888080)
  );
  hat.position.y = 1.85;
  hat.castShadow = true;
  totem.add(hat);
  // Two feathers sticking out
  for (const side of [-1, 1]) {
    const feather = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.16),
      FLAT(side > 0 ? 0xcc6644 : 0x4488cc)
    );
    feather.position.set(side * 0.16, 1.85, 0);
    feather.rotation.z = side * 0.4;
    totem.add(feather);
  }
  root.add(totem);

  // Small pile of decorative eggs in the nest
  const eggMat = new THREE.MeshLambertMaterial({
    color: 0xfff4d0,
    emissive: 0xffeacc,
    emissiveIntensity: 0.2,
  });
  for (let i = 0; i < 4; i++) {
    const eg = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), eggMat);
    eg.scale.y = 1.4;
    const ang = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 0.4;
    eg.position.set(
      Math.cos(ang) * r,
      0.32,
      Math.sin(ang) * r + 0.8
    );
    eg.rotation.z = (Math.random() - 0.5) * 0.4;
    eg.castShadow = true;
    root.add(eg);
  }

  // Subtle glow halo over the whole nest
  const halo = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 0.05, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffe89a,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    })
  );
  halo.position.y = 0.04;
  root.add(halo);

  root.userData.kind = 'home';
  root.userData.totem = totem;
  root.userData.halo = halo;
  root.userData.bobPhase = 0;

  scene.add(root);
  return root;
}

export function animateNest(nest, dt) {
  nest.userData.bobPhase += dt * 1.2;
  const ph = nest.userData.bobPhase;
  if (nest.userData.totem) {
    nest.userData.totem.rotation.y = Math.sin(ph * 0.3) * 0.05;
  }
  if (nest.userData.halo) {
    const s = 1 + Math.sin(ph) * 0.06;
    nest.userData.halo.scale.set(s, 1, s);
    nest.userData.halo.material.opacity = 0.15 + Math.sin(ph) * 0.05;
  }
}

// Distance from player to home (used for indicator + regen).
export function distanceToHome(nest, playerPos) {
  return Math.hypot(
    nest.position.x - playerPos.x,
    nest.position.z - playerPos.z
  );
}

// Returns true when the player is sitting in their nest.
export function isAtHome(nest, playerPos) {
  return distanceToHome(nest, playerPos) < HOME_RADIUS;
}
