import * as THREE from 'three';
import { WORLD_SIZE, PLAYABLE_RADIUS, getHeightAt } from './world.js';

// Park ranger jeeps (Jurassic Park style) that patrol the level and flee
// from the player — the classic "must go faster" chase. Chomp one for points.

const FLAT = (c) => new THREE.MeshLambertMaterial({ color: c });

export function buildJeep() {
  const root = new THREE.Group();

  const bodyColor = 0x6a7a4a;   // safari khaki/olive
  const trimColor = 0xb03a2a;   // red accent stripe
  const tireColor = 0x1a1a1a;
  const glassColor = 0x9ac4d4;

  // Chassis / lower body
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 2.2), FLAT(bodyColor));
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  root.add(chassis);

  // Red accent stripe along the side
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.12, 2.0), FLAT(trimColor));
  stripe.position.y = 0.5;
  root.add(stripe);

  // Hood (front, lower)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.7), FLAT(bodyColor));
  hood.position.set(0, 0.7, -0.85);
  hood.castShadow = true;
  root.add(hood);

  // Cabin / passenger box
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.1), FLAT(bodyColor));
  cabin.position.set(0, 0.95, 0.2);
  cabin.castShadow = true;
  root.add(cabin);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.08), FLAT(glassColor));
  windshield.position.set(0, 1.05, -0.35);
  windshield.rotation.x = -0.3;
  root.add(windshield);

  // Roll cage (open-top safari look) — 4 posts + roof bars
  const barMat = FLAT(0x2a2a2a);
  for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.7], [0.45, 0.7]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), barMat);
    post.position.set(x, 1.45, z);
    root.add(post);
  }
  const roofBarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.05), barMat);
  roofBarL.position.set(-0.45, 1.78, 0.2);
  root.add(roofBarL);
  const roofBarR = roofBarL.clone();
  roofBarR.position.x = 0.45;
  root.add(roofBarR);
  const roofBarF = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.06), barMat);
  roofBarF.position.set(0, 1.78, -0.3);
  root.add(roofBarF);
  const roofBarB = roofBarF.clone();
  roofBarB.position.z = 0.7;
  root.add(roofBarB);

  // Spotlight on the roll bar
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8),
    new THREE.MeshLambertMaterial({ color: 0xffffcc, emissive: 0xffff88, emissiveIntensity: 0.6 })
  );
  light.rotation.x = Math.PI / 2;
  light.position.set(0, 1.78, -0.42);
  root.add(light);

  // Wheels (animated spin)
  const wheels = [];
  const wheelGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
  for (const [x, z] of [[-0.58, -0.7], [0.58, -0.7], [-0.58, 0.7], [0.58, 0.7]]) {
    const wheel = new THREE.Mesh(wheelGeom, FLAT(tireColor));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.32, z);
    wheel.castShadow = true;
    // Hubcap
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 8), FLAT(0x888888));
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    root.add(hub);
    root.add(wheel);
    wheels.push(wheel);
  }

  root.userData.kind = 'vehicle';
  root.userData.size = 1.4;
  root.userData.nutrition = 3;
  root.userData.score = 25;
  root.userData.wheels = wheels;
  root.userData.speed = 9;
  root.userData.heading = Math.random() * Math.PI * 2;
  root.userData.turnTimer = 0;
  root.userData.honkTimer = 1 + Math.random() * 3;
  root.userData.fleeing = false;
  return root;
}

function placeRandom(obj, playerPos, minDist = 25) {
  for (let tries = 0; tries < 30; tries++) {
    const x = (Math.random() - 0.5) * PLAYABLE_RADIUS * 1.7;
    const z = (Math.random() - 0.5) * PLAYABLE_RADIUS * 1.7;
    if (Math.hypot(x - playerPos.x, z - playerPos.z) > minDist) {
      obj.position.set(x, getHeightAt(x, z), z);
      obj.rotation.y = obj.userData.heading;
      return;
    }
  }
  const x = (Math.random() - 0.5) * PLAYABLE_RADIUS * 1.6;
  const z = (Math.random() - 0.5) * PLAYABLE_RADIUS * 1.6;
  obj.position.set(x, getHeightAt(x, z), z);
}

export function spawnVehicles(scene, playerPos, count = 4) {
  const group = new THREE.Group();
  scene.add(group);
  for (let i = 0; i < count; i++) {
    const j = buildJeep();
    placeRandom(j, playerPos);
    group.add(j);
  }
  return group;
}

export function spawnVehicle(group, playerPos) {
  const j = buildJeep();
  placeRandom(j, playerPos);
  group.add(j);
  return j;
}

// Drive logic: patrol, but flee the player when close (the JP chase!).
// Returns 'honk' on frames the jeep should honk (so main can play sound).
export function animateVehicles(group, dt, playerPos) {
  const limit = PLAYABLE_RADIUS - 4;
  let honk = false;
  for (const v of group.children) {
    const d = v.userData;
    const distToPlayer = Math.hypot(
      v.position.x - playerPos.x,
      v.position.z - playerPos.z
    );

    if (distToPlayer < 18) {
      // FLEE: steer directly away from the player
      d.fleeing = true;
      const away = Math.atan2(
        v.position.x - playerPos.x,
        v.position.z - playerPos.z
      );
      // Smoothly turn toward the away heading
      let diff = away - d.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      d.heading += diff * Math.min(1, dt * 4);
      d.honkTimer -= dt;
      if (d.honkTimer <= 0) {
        honk = true;
        d.honkTimer = 1.5 + Math.random() * 2;
      }
    } else {
      // PATROL: drive straight, turn occasionally
      d.fleeing = false;
      d.turnTimer -= dt;
      if (d.turnTimer <= 0) {
        d.heading += (Math.random() - 0.5) * 1.2;
        d.turnTimer = 2 + Math.random() * 3;
      }
    }

    const speed = d.fleeing ? d.speed * 1.25 : d.speed * 0.55;
    const dirX = Math.sin(d.heading);
    const dirZ = Math.cos(d.heading);
    v.position.x += dirX * speed * dt;
    v.position.z += dirZ * speed * dt;

    // Turn around at the boundary
    if (Math.abs(v.position.x) > limit || Math.abs(v.position.z) > limit) {
      v.position.x = Math.max(-limit, Math.min(limit, v.position.x));
      v.position.z = Math.max(-limit, Math.min(limit, v.position.z));
      d.heading += Math.PI; // U-turn
    }

    // Sit on the terrain, facing travel direction
    v.position.y = getHeightAt(v.position.x, v.position.z);
    v.rotation.y = d.heading;

    // Spin the wheels proportional to speed
    if (d.wheels) {
      const spin = speed * dt * 3;
      for (const w of d.wheels) w.rotation.x += spin;
    }
  }
  return honk;
}
