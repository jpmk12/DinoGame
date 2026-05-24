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
 * Build a Kaiju — a Godzilla-inspired city-stomping titan. Upright biped
 * with glowing jagged dorsal plates down the back and tail. Faces -Z.
 */
export function buildKaiju(color = 0x3a4a44) {
  const root = new THREE.Group();
  const belly = 0x6a7a70;
  const plateMat = new THREE.MeshLambertMaterial({
    color: 0xbfe6ff,
    emissive: 0x66bbff,
    emissiveIntensity: 0.9, // bright enough to catch the bloom pass
  });

  // Upright torso (taller than a T-Rex, more vertical)
  const torso = box(1.0, 1.3, 0.95, color);
  torso.position.set(0, 1.5, -0.1);
  torso.rotation.x = -0.15;
  root.add(torso);
  const chest = box(0.85, 0.7, 0.85, belly);
  chest.position.set(0, 1.45, -0.45);
  chest.rotation.x = -0.15;
  root.add(chest);

  // Hips
  const hips = box(0.95, 0.8, 0.9, color);
  hips.position.set(0, 0.95, 0.1);
  root.add(hips);

  // Thick tail — three tapering segments sweeping back and down
  const tail1 = box(0.55, 0.55, 0.8, color);
  tail1.position.set(0, 0.8, 0.85);
  tail1.rotation.x = 0.3;
  root.add(tail1);
  const tail2 = box(0.38, 0.4, 0.75, color);
  tail2.position.set(0, 0.55, 1.5);
  tail2.rotation.x = 0.55;
  root.add(tail2);
  const tail3 = box(0.2, 0.22, 0.6, color);
  tail3.position.set(0, 0.28, 2.0);
  tail3.rotation.x = 0.7;
  root.add(tail3);

  // Neck + head held high
  const neck = box(0.45, 0.55, 0.45, color);
  neck.position.set(0, 2.2, -0.45);
  root.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 2.55, -0.6);
  const skull = box(0.55, 0.5, 0.75, color);
  head.add(skull);
  const jaw = box(0.5, 0.16, 0.62, 0x2a3a34);
  jaw.position.set(0, -0.28, -0.05);
  head.add(jaw);
  // Teeth
  for (let i = -1; i <= 1; i++) {
    const tooth = box(0.06, 0.13, 0.06, 0xfff8dc);
    tooth.position.set(i * 0.15, -0.16, -0.28);
    head.add(tooth);
  }
  // Glowing eyes
  for (const x of [-0.16, 0.16]) {
    const eyeGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffee88, emissive: 0xffdd44, emissiveIntensity: 0.8 })
    );
    eyeGlow.position.set(x, 0.1, -0.32);
    head.add(eyeGlow);
  }
  // Small head spines/ears
  for (const x of [-0.2, 0.2]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), plateMat);
    fin.position.set(x, 0.28, 0.1);
    head.add(fin);
  }
  root.add(head);

  // Dorsal plates: jagged glowing fins from the neck, down the back, to
  // the tail tip. Each is a flattened 4-sided cone (maple-leaf-ish).
  const spinePath = [
    [2.0, -0.45, 0.55], [1.85, -0.3, 0.7], [1.7, -0.1, 0.8],
    [1.55, 0.15, 0.85], [1.4, 0.5, 0.85], [1.25, 0.85, 0.75],
    [1.0, 1.0, 0.6], [0.75, 1.4, 0.5], [0.5, 1.85, 0.35],
    [0.28, 2.0, 0.22],
  ];
  for (const [y, z, size] of spinePath) {
    const plate = new THREE.Mesh(new THREE.ConeGeometry(size * 0.45, size, 4), plateMat);
    plate.scale.z = 0.35; // flatten front-to-back into a fin
    plate.position.set(0, y + size * 0.4, z);
    plate.rotation.y = Math.PI / 4;
    plate.castShadow = true;
    root.add(plate);
  }

  // Stubby but visible arms with claws
  for (const side of [-1, 1]) {
    const arm = box(0.16, 0.5, 0.18, color);
    arm.position.set(side * 0.6, 1.45, -0.5);
    arm.rotation.z = side * 0.3;
    root.add(arm);
    const forearm = box(0.13, 0.35, 0.15, color);
    forearm.position.set(side * 0.72, 1.15, -0.62);
    root.add(forearm);
  }

  // Powerful legs (animated)
  const legL = new THREE.Group();
  legL.position.set(-0.32, 0.95, 0.1);
  const legLMesh = box(0.34, 1.0, 0.42, color);
  legLMesh.position.y = -0.45;
  legL.add(legLMesh);
  const footL = box(0.4, 0.2, 0.6, color);
  footL.position.set(0, -0.95, -0.1);
  legL.add(footL);
  root.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.32, 0.95, 0.1);
  const legRMesh = box(0.34, 1.0, 0.42, color);
  legRMesh.position.y = -0.45;
  legR.add(legRMesh);
  const footR = box(0.4, 0.2, 0.6, color);
  footR.position.set(0, -0.95, -0.1);
  legR.add(footR);
  root.add(legR);

  root.userData.parts = { head, tail2, tail3, legL, legR, jaw };
  return root;
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
 * Stegosaurus — quadruped with double row of back plates and tail spikes.
 */
export function buildStego(color = 0x6a8a4a) {
  const root = new THREE.Group();
  const belly = 0xc0a070;
  const plateCol = 0xc46a3a;
  const spikeCol = 0xeae0c0;

  const body = box(0.95, 0.7, 1.5, color);
  body.position.y = 0.85;
  root.add(body);
  const bellyMesh = box(0.9, 0.4, 1.35, belly);
  bellyMesh.position.set(0, 0.65, 0);
  root.add(bellyMesh);

  // Back plates (5, alternating)
  for (let i = 0; i < 5; i++) {
    const z = -0.65 + i * 0.32;
    const plate = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.55, 4),
      FLAT(plateCol)
    );
    plate.castShadow = true;
    plate.position.set(0, 1.45, z);
    plate.rotation.y = Math.PI / 4;
    root.add(plate);
  }

  // Tail
  const tail1 = box(0.45, 0.45, 0.65, color);
  tail1.position.set(0, 0.8, 0.95);
  root.add(tail1);
  const tail2 = box(0.28, 0.3, 0.55, color);
  tail2.position.set(0, 0.75, 1.5);
  root.add(tail2);
  // Tail spikes
  for (const x of [-0.1, 0.1]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 6), FLAT(spikeCol));
    sp.castShadow = true;
    sp.position.set(x, 0.85, 1.75);
    sp.rotation.x = Math.PI / 2;
    root.add(sp);
  }

  // Small head
  const head = new THREE.Group();
  head.position.set(0, 0.55, -1.0);
  const skull = box(0.35, 0.3, 0.5, color);
  head.add(skull);
  const beak = box(0.25, 0.15, 0.2, 0x6a4a2a);
  beak.position.set(0, -0.1, -0.3);
  head.add(beak);
  eye(head, -0.13, 0.05, -0.2);
  eye(head, 0.13, 0.05, -0.2);
  root.add(head);

  // Four short legs
  const legs = {};
  for (const [name, x, z] of [
    ['legFL', -0.32, -0.55],
    ['legFR',  0.32, -0.55],
    ['legBL', -0.32,  0.55],
    ['legBR',  0.32,  0.55],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, 0.45, z);
    const m = box(0.26, 0.85, 0.3, color);
    m.position.y = -0.35;
    g.add(m);
    root.add(g);
    legs[name] = g;
  }

  root.userData.parts = {
    head, tail2,
    legL: legs.legFL, legR: legs.legFR,
    legBL: legs.legBL, legBR: legs.legBR,
    quad: true,
  };
  return root;
}

/**
 * Velociraptor — small, fast biped with raised tail and snouty head.
 */
export function buildRaptor(color = 0x8a6a3a) {
  const root = new THREE.Group();
  const accent = 0x5a3a1a;
  const belly = 0xd4b070;

  // Body — slimmer
  const body = box(0.55, 0.55, 1.1, color);
  body.position.y = 0.85;
  root.add(body);
  const bellyMesh = box(0.5, 0.3, 0.95, belly);
  bellyMesh.position.set(0, 0.7, 0);
  root.add(bellyMesh);

  // Stiff raised tail (single bar, slanted up at back)
  const tail = box(0.22, 0.22, 1.2, color);
  tail.position.set(0, 1.0, 1.05);
  tail.rotation.x = -0.15;
  root.add(tail);
  const tailTip = box(0.12, 0.14, 0.4, accent);
  tailTip.position.set(0, 1.18, 1.75);
  root.add(tailTip);

  // Head with snout
  const head = new THREE.Group();
  head.position.set(0, 1.1, -0.85);
  const skull = box(0.35, 0.35, 0.4, color);
  head.add(skull);
  const snout = box(0.3, 0.22, 0.4, color);
  snout.position.set(0, -0.05, -0.35);
  head.add(snout);
  const jaw = box(0.28, 0.1, 0.38, accent);
  jaw.position.set(0, -0.18, -0.34);
  head.add(jaw);
  // Tiny teeth
  for (let i = -1; i <= 1; i++) {
    const tooth = box(0.04, 0.08, 0.04, 0xfff8dc);
    tooth.position.set(i * 0.09, -0.13, -0.5);
    head.add(tooth);
  }
  eye(head, -0.13, 0.1, -0.18);
  eye(head, 0.13, 0.1, -0.18);
  root.add(head);

  // Arms with claws
  const armL = box(0.1, 0.32, 0.1, color);
  armL.position.set(-0.32, 0.85, -0.3);
  root.add(armL);
  const armR = box(0.1, 0.32, 0.1, color);
  armR.position.set(0.32, 0.85, -0.3);
  root.add(armR);

  // Legs (sickle-claw raptor legs)
  const legL = new THREE.Group();
  legL.position.set(-0.18, 0.55, 0);
  const legLMesh = box(0.22, 0.85, 0.3, color);
  legLMesh.position.y = -0.35;
  legL.add(legLMesh);
  const clawL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), FLAT(0x222020));
  clawL.position.set(0, -0.75, -0.15);
  clawL.rotation.x = -1.0;
  legL.add(clawL);
  root.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.18, 0.55, 0);
  const legRMesh = box(0.22, 0.85, 0.3, color);
  legRMesh.position.y = -0.35;
  legR.add(legRMesh);
  const clawR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), FLAT(0x222020));
  clawR.position.set(0, -0.75, -0.15);
  clawR.rotation.x = -1.0;
  legR.add(clawR);
  root.add(legR);

  root.userData.parts = { head, tail2: tailTip, legL, legR, jaw };
  return root;
}

/**
 * Brachiosaurus — long-necked giant herbivore.
 */
export function buildBrachio(color = 0x7a6a8a) {
  const root = new THREE.Group();
  const belly = 0xb0a8c0;

  // Big chunky body
  const body = box(1.2, 1.0, 1.8, color);
  body.position.y = 1.1;
  root.add(body);
  const bellyMesh = box(1.15, 0.55, 1.6, belly);
  bellyMesh.position.set(0, 0.85, 0);
  root.add(bellyMesh);

  // Long neck — series of stacked boxes curving up
  const neckSegments = 5;
  for (let i = 0; i < neckSegments; i++) {
    const t = i / (neckSegments - 1);
    const seg = box(0.4 - t * 0.1, 0.4 - t * 0.05, 0.4, color);
    seg.position.set(0, 1.55 + i * 0.35, -0.85 - i * 0.18);
    root.add(seg);
  }

  // Small head atop neck
  const head = new THREE.Group();
  head.position.set(0, 3.15, -1.7);
  const skull = box(0.35, 0.3, 0.45, color);
  head.add(skull);
  const snout = box(0.28, 0.22, 0.3, color);
  snout.position.set(0, -0.04, -0.35);
  head.add(snout);
  eye(head, -0.14, 0.08, -0.2);
  eye(head, 0.14, 0.08, -0.2);
  root.add(head);

  // Long tail
  const tail1 = box(0.55, 0.55, 0.8, color);
  tail1.position.set(0, 1.05, 1.15);
  root.add(tail1);
  const tail2 = box(0.35, 0.35, 0.7, color);
  tail2.position.set(0, 1.0, 1.85);
  root.add(tail2);
  const tail3 = box(0.18, 0.2, 0.5, color);
  tail3.position.set(0, 0.95, 2.4);
  root.add(tail3);

  // Four pillar legs
  const legs = {};
  for (const [name, x, z] of [
    ['legFL', -0.42, -0.65],
    ['legFR',  0.42, -0.65],
    ['legBL', -0.42,  0.65],
    ['legBR',  0.42,  0.65],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, 0.6, z);
    const m = box(0.32, 1.2, 0.35, color);
    m.position.y = -0.5;
    g.add(m);
    root.add(g);
    legs[name] = g;
  }

  root.userData.parts = {
    head, tail2: tail3,
    legL: legs.legFL, legR: legs.legFR,
    legBL: legs.legBL, legBR: legs.legBR,
    quad: true,
  };
  return root;
}

/**
 * Spinosaurus — biped with big sail on its back and crocodile-like snout.
 */
export function buildSpino(color = 0x3a5a7a) {
  const root = new THREE.Group();
  const accent = 0x1a3a5a;
  const belly = 0xa0c0d0;
  const sailCol = 0x8a3a3a;

  const body = box(0.95, 0.7, 1.6, color);
  body.position.y = 0.95;
  root.add(body);
  const bellyMesh = box(0.9, 0.4, 1.45, belly);
  bellyMesh.position.set(0, 0.75, 0);
  root.add(bellyMesh);

  // Big sail on back — three tall plates merged feel
  const sail = box(0.15, 1.1, 1.4, sailCol);
  sail.position.set(0, 1.65, 0);
  root.add(sail);
  // Lighter trim
  const sailTrim = box(0.18, 0.18, 1.4, 0xc46a6a);
  sailTrim.position.set(0, 2.1, 0);
  root.add(sailTrim);

  // Tail
  const tail1 = box(0.5, 0.5, 0.75, color);
  tail1.position.set(0, 0.9, 1.05);
  root.add(tail1);
  const tail2 = box(0.3, 0.3, 0.6, color);
  tail2.position.set(0, 0.85, 1.7);
  root.add(tail2);

  // Long crocodile-like head
  const head = new THREE.Group();
  head.position.set(0, 1.25, -1.2);
  const skull = box(0.45, 0.4, 0.55, color);
  head.add(skull);
  const snout = box(0.4, 0.3, 0.65, color);
  snout.position.set(0, -0.05, -0.55);
  head.add(snout);
  const jaw = box(0.38, 0.14, 0.95, accent);
  jaw.position.set(0, -0.22, -0.4);
  head.add(jaw);
  // Crocodile teeth
  for (let i = -2; i <= 2; i++) {
    const tooth = box(0.05, 0.1, 0.05, 0xfff8dc);
    tooth.position.set(i * 0.08, -0.16, -0.7);
    head.add(tooth);
  }
  eye(head, -0.18, 0.12, -0.2);
  eye(head, 0.18, 0.12, -0.2);
  root.add(head);

  // Legs
  const legL = new THREE.Group();
  legL.position.set(-0.3, 0.65, 0);
  const legLMesh = box(0.3, 1.1, 0.36, color);
  legLMesh.position.y = -0.45;
  legL.add(legLMesh);
  root.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.3, 0.65, 0);
  const legRMesh = box(0.3, 1.1, 0.36, color);
  legRMesh.position.y = -0.45;
  legR.add(legRMesh);
  root.add(legR);

  root.userData.parts = { head, tail2, legL, legR, jaw };
  return root;
}

/**
 * Ankylosaurus — low, wide, armored quadruped with club tail.
 */
export function buildAnky(color = 0x6a5a4a) {
  const root = new THREE.Group();
  const armor = 0x5a4a3a;
  const spikeCol = 0x8a7a6a;

  const body = box(1.0, 0.55, 1.5, color);
  body.position.y = 0.6;
  root.add(body);

  // Armor plates on back
  for (let i = 0; i < 4; i++) {
    const plate = box(0.95, 0.18, 0.32, armor);
    plate.position.set(0, 0.95, -0.55 + i * 0.4);
    root.add(plate);
  }
  // Side spikes
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 5), FLAT(spikeCol));
      sp.castShadow = true;
      sp.position.set(side * 0.55, 0.7, -0.4 + i * 0.4);
      sp.rotation.z = side * Math.PI / 2;
      root.add(sp);
    }
  }

  // Tail with club
  const tail1 = box(0.4, 0.35, 0.55, color);
  tail1.position.set(0, 0.6, 0.95);
  root.add(tail1);
  const tail2 = box(0.25, 0.25, 0.45, color);
  tail2.position.set(0, 0.6, 1.45);
  root.add(tail2);
  const club = sphere(0.32, armor);
  club.position.set(0, 0.6, 1.85);
  root.add(club);

  // Wide low head
  const head = new THREE.Group();
  head.position.set(0, 0.5, -0.95);
  const skull = box(0.55, 0.3, 0.4, color);
  head.add(skull);
  const beak = box(0.45, 0.18, 0.2, 0x6a4a2a);
  beak.position.set(0, -0.06, -0.28);
  head.add(beak);
  // Head spikes
  for (const x of [-0.22, 0.22]) {
    const hs = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), FLAT(spikeCol));
    hs.castShadow = true;
    hs.position.set(x, 0.18, -0.05);
    head.add(hs);
  }
  eye(head, -0.2, 0.02, -0.18);
  eye(head, 0.2, 0.02, -0.18);
  root.add(head);

  // Four short stout legs
  const legs = {};
  for (const [name, x, z] of [
    ['legFL', -0.36, -0.55],
    ['legFR',  0.36, -0.55],
    ['legBL', -0.36,  0.55],
    ['legBR',  0.36,  0.55],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, 0.35, z);
    const m = box(0.3, 0.65, 0.32, color);
    m.position.y = -0.25;
    g.add(m);
    root.add(g);
    legs[name] = g;
  }

  root.userData.parts = {
    head, tail2,
    legL: legs.legFL, legR: legs.legFR,
    legBL: legs.legBL, legBR: legs.legBR,
    quad: true,
  };
  return root;
}

/**
 * Parasaurolophus — biped/quadruped herbivore with curved head crest.
 */
export function buildPara(color = 0x4a8a8a) {
  const root = new THREE.Group();
  const belly = 0xb0d0c0;
  const crestCol = 0xc46a8a;

  const body = box(0.85, 0.65, 1.35, color);
  body.position.y = 0.95;
  root.add(body);
  const bellyMesh = box(0.8, 0.4, 1.2, belly);
  bellyMesh.position.set(0, 0.75, 0);
  root.add(bellyMesh);

  // Tail
  const tail1 = box(0.4, 0.4, 0.7, color);
  tail1.position.set(0, 0.9, 0.9);
  root.add(tail1);
  const tail2 = box(0.22, 0.22, 0.55, color);
  tail2.position.set(0, 0.85, 1.5);
  root.add(tail2);

  // Head with curved crest
  const head = new THREE.Group();
  head.position.set(0, 1.2, -0.95);
  const skull = box(0.4, 0.4, 0.5, color);
  head.add(skull);
  const snout = box(0.3, 0.25, 0.35, color);
  snout.position.set(0, -0.06, -0.4);
  head.add(snout);
  const beak = box(0.28, 0.12, 0.18, 0x6a4a2a);
  beak.position.set(0, -0.2, -0.5);
  head.add(beak);
  // Crest — angled backward and up
  const crest1 = box(0.15, 0.35, 0.5, crestCol);
  crest1.position.set(0, 0.3, 0.15);
  crest1.rotation.x = 0.45;
  head.add(crest1);
  const crest2 = box(0.13, 0.18, 0.4, crestCol);
  crest2.position.set(0, 0.55, 0.4);
  crest2.rotation.x = 0.7;
  head.add(crest2);
  eye(head, -0.15, 0.08, -0.22);
  eye(head, 0.15, 0.08, -0.22);
  root.add(head);

  // Bipedal stance — small arms
  const armL = box(0.1, 0.28, 0.1, color);
  armL.position.set(-0.4, 0.85, -0.3);
  root.add(armL);
  const armR = box(0.1, 0.28, 0.1, color);
  armR.position.set(0.4, 0.85, -0.3);
  root.add(armR);

  // Strong back legs
  const legL = new THREE.Group();
  legL.position.set(-0.25, 0.6, 0.1);
  const legLMesh = box(0.28, 1.0, 0.34, color);
  legLMesh.position.y = -0.4;
  legL.add(legLMesh);
  root.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.25, 0.6, 0.1);
  const legRMesh = box(0.28, 1.0, 0.34, color);
  legRMesh.position.y = -0.4;
  legR.add(legRMesh);
  root.add(legR);

  root.userData.parts = { head, tail2, legL, legR };
  return root;
}

/**
 * Pteranodon — flying reptile. Wings spread out wide. Hovers above ground.
 */
export function buildPtero(color = 0x6a4a8a) {
  const root = new THREE.Group();
  const wingCol = 0x5a3a7a;
  const crestCol = 0xc46a6a;

  // Body — small, sleek
  const body = box(0.45, 0.4, 0.85, color);
  body.position.y = 1.2;
  root.add(body);

  // Wings — long flat boxes, slightly angled
  const wingL = box(1.8, 0.08, 0.5, wingCol);
  wingL.position.set(-1.1, 1.25, 0);
  wingL.rotation.z = 0.15;
  root.add(wingL);
  const wingR = box(1.8, 0.08, 0.5, wingCol);
  wingR.position.set(1.1, 1.25, 0);
  wingR.rotation.z = -0.15;
  root.add(wingR);

  // Long beak head
  const head = new THREE.Group();
  head.position.set(0, 1.35, -0.55);
  const skull = box(0.28, 0.3, 0.35, color);
  head.add(skull);
  const beak = box(0.18, 0.15, 0.6, 0xeae0c0);
  beak.position.set(0, -0.04, -0.45);
  head.add(beak);
  // Crest back of head
  const crest = box(0.1, 0.35, 0.45, crestCol);
  crest.position.set(0, 0.25, 0.25);
  crest.rotation.x = 0.5;
  head.add(crest);
  eye(head, -0.1, 0.04, -0.18);
  eye(head, 0.1, 0.04, -0.18);
  root.add(head);

  // Tiny tail
  const tail = box(0.1, 0.1, 0.4, color);
  tail.position.set(0, 1.2, 0.55);
  root.add(tail);

  // Small legs tucked
  const legL = box(0.08, 0.2, 0.08, color);
  legL.position.set(-0.1, 1.0, 0.15);
  root.add(legL);
  const legR = box(0.08, 0.2, 0.08, color);
  legR.position.set(0.1, 1.0, 0.15);
  root.add(legR);

  root.userData.parts = {
    head, tail2: tail,
    wingL, wingR,
    flying: true,
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
 * Palm tree — tall thin trunk + radial fronds. Used by tropical levels.
 */
export function buildPalmTree() {
  const root = new THREE.Group();
  // Curved-ish trunk built from stacked tilted cylinders
  const segs = 5;
  const trunkColor = 0x8a6a3a;
  const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor });
  let py = 0;
  let lean = (Math.random() - 0.5) * 0.25;
  for (let i = 0; i < segs; i++) {
    const r = 0.18 - i * 0.02;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.85, r, 0.7, 6),
      trunkMat
    );
    seg.position.set(lean * i * 0.15, py + 0.35, lean * i * 0.1);
    seg.castShadow = true;
    seg.receiveShadow = true;
    root.add(seg);
    py += 0.65;
  }
  // Crown — 6-8 fronds radiating outward
  const crown = new THREE.Group();
  crown.position.set(lean * (segs - 1) * 0.15, py + 0.1, lean * (segs - 1) * 0.1);
  const frondMat = new THREE.MeshLambertMaterial({
    color: 0x3a8a3a,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2;
    const frond = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 1.6, 1, 4),
      frondMat
    );
    // Bend it down at the tip via vertex displacement
    const pos = frond.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      // y goes from -0.8 to 0.8; tip at +0.8 should droop
      if (y > 0) {
        pos.setZ(v, -((y / 0.8) ** 2) * 0.6);
      }
    }
    pos.needsUpdate = true;
    frond.geometry.computeVertexNormals();
    frond.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
    frond.rotation.y = angle + Math.PI / 2;
    frond.rotation.x = -0.5; // angle upward at the base
    frond.castShadow = true;
    crown.add(frond);
  }
  // Coconut cluster (a few small spheres)
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    c.position.set(
      (Math.random() - 0.5) * 0.3,
      -0.05,
      (Math.random() - 0.5) * 0.3
    );
    c.castShadow = true;
    crown.add(c);
  }
  root.add(crown);
  return root;
}

/**
 * Fern — low ground decoration for tropical zones.
 */
export function buildFern() {
  const root = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: 0x4aa050,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.9, 1, 3),
      mat
    );
    const pos = blade.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      if (y > 0) pos.setZ(v, -((y / 0.45) ** 2) * 0.25);
    }
    pos.needsUpdate = true;
    blade.geometry.computeVertexNormals();
    blade.position.y = 0.45;
    blade.rotation.y = (i / blades) * Math.PI * 2;
    blade.rotation.x = -0.4;
    blade.castShadow = true;
    root.add(blade);
  }
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
 * Species registry. Each entry defines the dinosaur's identity, stats,
 * and how to build it procedurally. The model loader uses `modelFile`
 * to optionally swap in a Quaternius GLB from /models/.
 *
 * stats:
 *   speedMult — multiplier on base speed (1.0 = baseline)
 *   scaleMult — multiplier on stage scale (1.0 = baseline)
 *   diet      — 'carnivore' | 'herbivore' (cosmetic/flavor only for now)
 */
export const SPECIES = {
  trex: {
    name: 'T-Rex',
    desc: 'Fierce predator',
    color: 0x8b3a3a,
    build: buildTRex,
    modelFile: 'Tyrannosaurus.glb',
    speedMult: 1.0,
    scaleMult: 1.0,
    diet: 'carnivore',
    playable: true,
  },
  kaiju: {
    name: 'Kaiju',
    desc: 'City-stomping titan',
    color: 0x3a4a44,
    build: buildKaiju,
    modelFile: null,
    speedMult: 0.85,
    scaleMult: 1.25,
    diet: 'carnivore',
    playable: true,
  },
  trike: {
    name: 'Triceratops',
    desc: 'Mighty plant-eater',
    color: 0x5a7a3a,
    build: buildTriceratops,
    modelFile: 'Triceratops.glb',
    speedMult: 0.9,
    scaleMult: 1.0,
    diet: 'herbivore',
    playable: true,
  },
  stego: {
    name: 'Stegosaurus',
    desc: 'Plated tank',
    color: 0x6a8a4a,
    build: buildStego,
    modelFile: 'Stegosaurus.glb',
    speedMult: 0.85,
    scaleMult: 1.0,
    diet: 'herbivore',
    playable: true,
  },
  raptor: {
    name: 'Velociraptor',
    desc: 'Fast and sneaky',
    color: 0x8a6a3a,
    build: buildRaptor,
    modelFile: 'Velociraptor.glb',
    speedMult: 1.4,
    scaleMult: 0.7,
    diet: 'carnivore',
    playable: true,
  },
  brachio: {
    name: 'Brachiosaurus',
    desc: 'Long-necked giant',
    color: 0x7a6a8a,
    build: buildBrachio,
    modelFile: 'Brachiosaurus.glb',
    speedMult: 0.7,
    scaleMult: 1.3,
    diet: 'herbivore',
    playable: true,
  },
  spino: {
    name: 'Spinosaurus',
    desc: 'Sail-backed hunter',
    color: 0x3a5a7a,
    build: buildSpino,
    modelFile: 'Spinosaurus.glb',
    speedMult: 1.05,
    scaleMult: 1.1,
    diet: 'carnivore',
    playable: true,
  },
  anky: {
    name: 'Ankylosaurus',
    desc: 'Armored club-tail',
    color: 0x6a5a4a,
    build: buildAnky,
    modelFile: 'Ankylosaurus.glb',
    speedMult: 0.75,
    scaleMult: 0.95,
    diet: 'herbivore',
    playable: false,
  },
  para: {
    name: 'Parasaurolophus',
    desc: 'Crested grazer',
    color: 0x4a8a8a,
    build: buildPara,
    modelFile: 'Parasaurolophus.glb',
    speedMult: 1.1,
    scaleMult: 0.95,
    diet: 'herbivore',
    playable: false,
  },
  ptero: {
    name: 'Pteranodon',
    desc: 'Sky glider',
    color: 0x6a4a8a,
    build: buildPtero,
    modelFile: 'Pteranodon.glb',
    speedMult: 1.3,
    scaleMult: 0.8,
    diet: 'carnivore',
    playable: false,
  },
};

export const PLAYABLE_SPECIES = Object.keys(SPECIES).filter(
  (k) => SPECIES[k].playable
);
export const ALL_SPECIES = Object.keys(SPECIES);

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
