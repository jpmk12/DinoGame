import * as THREE from 'three';

// Procedural low-poly dinos built from boxes/spheres.
// Returns a THREE.Group with userData.parts for animation.

const FLAT = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), FLAT(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), FLAT(color));
  m.castShadow = true;
  return m;
}

function eye(parent, x, y, z) {
  const e = sphere(0.07, 0xffffff);
  e.position.set(x, y, z);
  parent.add(e);
  const p = sphere(0.035, 0x000000);
  p.position.set(x, y, z + 0.045);
  parent.add(p);
}

/**
 * Build a T-Rex.
 * Orientation: faces -Z (forward). Pivot at feet center.
 */
export function buildTRex(color = 0x8b3a3a) {
  const root = new THREE.Group();
  const accent = 0x5a2424;
  const belly = 0xd4a874;

  // Body
  const body = box(0.9, 0.7, 1.5, color);
  body.position.y = 0.85;
  root.add(body);

  // Belly stripe
  const bellyMesh = box(0.85, 0.4, 1.35, belly);
  bellyMesh.position.set(0, 0.65, 0);
  root.add(bellyMesh);

  // Tail (three segments tapering)
  const tail1 = box(0.55, 0.5, 0.7, color);
  tail1.position.set(0, 0.85, 0.95);
  root.add(tail1);
  const tail2 = box(0.35, 0.35, 0.6, color);
  tail2.position.set(0, 0.8, 1.55);
  root.add(tail2);
  const tail3 = box(0.18, 0.2, 0.5, color);
  tail3.position.set(0, 0.78, 2.05);
  root.add(tail3);

  // Neck + head
  const neck = box(0.45, 0.5, 0.4, color);
  neck.position.set(0, 1.15, -0.85);
  root.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 1.25, -1.25);
  const skull = box(0.55, 0.55, 0.7, color);
  head.add(skull);
  const jaw = box(0.5, 0.18, 0.6, accent);
  jaw.position.set(0, -0.28, 0.05);
  head.add(jaw);
  // Teeth
  for (let i = -1; i <= 1; i++) {
    const tooth = box(0.06, 0.12, 0.06, 0xfff8dc);
    tooth.position.set(i * 0.15, -0.18, -0.25);
    head.add(tooth);
  }
  eye(head, -0.18, 0.12, -0.28);
  eye(head, 0.18, 0.12, -0.28);
  root.add(head);

  // Tiny arms
  const armL = box(0.12, 0.3, 0.12, color);
  armL.position.set(-0.45, 0.85, -0.45);
  root.add(armL);
  const armR = box(0.12, 0.3, 0.12, color);
  armR.position.set(0.45, 0.85, -0.45);
  root.add(armR);

  // Legs (these will be animated)
  const legL = new THREE.Group();
  legL.position.set(-0.28, 0.55, 0);
  const legLMesh = box(0.28, 1.0, 0.35, color);
  legLMesh.position.y = -0.4;
  legL.add(legLMesh);
  root.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.28, 0.55, 0);
  const legRMesh = box(0.28, 1.0, 0.35, color);
  legRMesh.position.y = -0.4;
  legR.add(legRMesh);
  root.add(legR);

  root.userData.parts = { head, tail2, tail3, legL, legR, jaw };
  return root;
}

/**
 * Build a Triceratops. Faces -Z.
 */
export function buildTriceratops(color = 0x5a7a3a) {
  const root = new THREE.Group();
  const accent = 0x3a5a24;
  const belly = 0xc4b074;
  const horn = 0xeae0c0;
  const frill = 0xa05a3a;

  // Body — chunkier than T-Rex
  const body = box(1.1, 0.85, 1.6, color);
  body.position.y = 0.85;
  root.add(body);

  const bellyMesh = box(1.05, 0.45, 1.4, belly);
  bellyMesh.position.set(0, 0.6, 0);
  root.add(bellyMesh);

  // Tail (short)
  const tail1 = box(0.5, 0.5, 0.6, color);
  tail1.position.set(0, 0.85, 0.95);
  root.add(tail1);
  const tail2 = box(0.3, 0.3, 0.5, color);
  tail2.position.set(0, 0.78, 1.45);
  root.add(tail2);

  // Head + frill + horns
  const head = new THREE.Group();
  head.position.set(0, 0.85, -1.15);

  const skull = box(0.7, 0.6, 0.8, color);
  head.add(skull);

  // Frill (big plate behind head)
  const frillMesh = box(1.3, 1.0, 0.18, frill);
  frillMesh.position.set(0, 0.18, 0.45);
  head.add(frillMesh);

  // Beak
  const beak = box(0.35, 0.2, 0.3, 0x6a4a2a);
  beak.position.set(0, -0.18, -0.5);
  head.add(beak);

  // Nose horn
  const noseHorn = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.3, 8),
    FLAT(horn)
  );
  noseHorn.castShadow = true;
  noseHorn.position.set(0, 0.2, -0.35);
  noseHorn.rotation.x = -0.3;
  head.add(noseHorn);

  // Two brow horns
  for (const x of [-0.22, 0.22]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 8), FLAT(horn));
    h.castShadow = true;
    h.position.set(x, 0.4, -0.15);
    h.rotation.x = -0.6;
    head.add(h);
  }

  eye(head, -0.28, 0.15, -0.35);
  eye(head, 0.28, 0.15, -0.35);

  root.add(head);

  // Four legs (all animated)
  const legPositions = [
    ['legFL', -0.38, 0, -0.55],
    ['legFR',  0.38, 0, -0.55],
    ['legBL', -0.38, 0,  0.55],
    ['legBR',  0.38, 0,  0.55],
  ];
  const legs = {};
  for (const [name, x, , z] of legPositions) {
    const g = new THREE.Group();
    g.position.set(x, 0.5, z);
    const m = box(0.28, 0.9, 0.32, color);
    m.position.y = -0.35;
    g.add(m);
    root.add(g);
    legs[name] = g;
  }

  root.userData.parts = {
    head,
    tail2,
    legL: legs.legFL,
    legR: legs.legFR,
    legBL: legs.legBL,
    legBR: legs.legBR,
    quad: true,
  };
  return root;
}

/**
 * Small critter food (a generic lizard/compy).
 */
export function buildCritter(color = 0xc4a050) {
  const root = new THREE.Group();
  const body = box(0.35, 0.25, 0.6, color);
  body.position.y = 0.25;
  root.add(body);

  const head = box(0.25, 0.22, 0.28, color);
  head.position.set(0, 0.3, -0.4);
  root.add(head);
  eye(head, -0.08, 0.04, -0.12);
  eye(head, 0.08, 0.04, -0.12);

  const tail = box(0.15, 0.12, 0.5, color);
  tail.position.set(0, 0.25, 0.5);
  root.add(tail);

  const legL = box(0.08, 0.2, 0.08, color);
  legL.position.set(-0.16, 0.1, 0.15);
  root.add(legL);
  const legR = box(0.08, 0.2, 0.08, color);
  legR.position.set(0.16, 0.1, 0.15);
  root.add(legR);

  root.userData.parts = { tail, head };
  return root;
}

/**
 * Plant — a low-poly bush.
 */
export function buildPlant() {
  const root = new THREE.Group();
  const colors = [0x3a8a3a, 0x4aa050, 0x5ab050];
  const c = colors[Math.floor(Math.random() * colors.length)];
  for (let i = 0; i < 3; i++) {
    const blob = sphere(0.18 + Math.random() * 0.12, c);
    blob.position.set(
      (Math.random() - 0.5) * 0.3,
      0.18 + Math.random() * 0.18,
      (Math.random() - 0.5) * 0.3
    );
    root.add(blob);
  }
  return root;
}

/**
 * A tree (decoration, not food).
 */
export function buildTree() {
  const root = new THREE.Group();
  const trunk = box(0.4, 1.8, 0.4, 0x5a3a1a);
  trunk.position.y = 0.9;
  root.add(trunk);
  const leaves = sphere(1.0, 0x2a7a3a);
  leaves.position.y = 2.1;
  root.add(leaves);
  const leaves2 = sphere(0.7, 0x3a8a3a);
  leaves2.position.set(0.4, 2.4, -0.2);
  root.add(leaves2);
  return root;
}

/**
 * Cactus for the desert biome.
 */
export function buildCactus() {
  const root = new THREE.Group();
  const body = box(0.4, 1.6, 0.4, 0x4a8a4a);
  body.position.y = 0.8;
  root.add(body);
  const armL = box(0.25, 0.7, 0.25, 0x4a8a4a);
  armL.position.set(-0.3, 1.1, 0);
  root.add(armL);
  const armR = box(0.25, 0.5, 0.25, 0x4a8a4a);
  armR.position.set(0.3, 1.3, 0);
  root.add(armR);
  return root;
}

/**
 * Rock decoration.
 */
export function buildRock() {
  const root = new THREE.Group();
  const r = 0.4 + Math.random() * 0.4;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(r, 0),
    FLAT(0x888080)
  );
  rock.castShadow = true;
  rock.position.y = r * 0.5;
  rock.rotation.y = Math.random() * Math.PI;
  root.add(rock);
  return root;
}
