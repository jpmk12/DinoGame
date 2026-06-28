import * as THREE from 'three';
import { PLAYABLE_RADIUS, getHeightAt } from './world.js';
import { buildWaterRect } from './water.js';

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
  // Flame stack — layered cones with their own materials so we can flicker
  // them independently each frame. Tall yellow core inside an orange shell
  // inside a red outer flame, all emissive enough to bloom.
  const flameLayers = [];
  const flameSpecs = [
    { r: 0.7, h: 1.6, color: 0xff3a1a, alpha: 0.85 },
    { r: 0.45, h: 1.4, color: 0xff8a3a, alpha: 0.9 },
    { r: 0.22, h: 1.1, color: 0xffe09a, alpha: 1.0 },
  ];
  for (const s of flameSpecs) {
    const mat = new THREE.MeshBasicMaterial({
      color: s.color,
      transparent: true,
      opacity: s.alpha,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.h, 10), mat);
    flame.position.y = 6.3 + s.h * 0.4;
    flame.renderOrder = 5;
    tower.add(flame);
    flameLayers.push({ mesh: flame, baseH: s.h, mat });
  }
  // Subtle smoke puffs floating above the flame
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x444444, transparent: true, opacity: 0.4,
    depthWrite: false,
  });
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.4 + i * 0.07, 8, 6), smokeMat.clone());
    puff.position.set((Math.random() - 0.5) * 0.5, 8.4 + i * 0.6, (Math.random() - 0.5) * 0.5);
    tower.add(puff);
    smoke.push(puff);
  }
  root.add(tower);

  root.userData.kind = 'building';
  root.userData.size = 4.5;
  root.userData.score = 120;
  root.userData.health = 1;
  root.userData.subtype = 'oilRig';
  root.userData.flameLayers = flameLayers;
  root.userData.smoke = smoke;
  root.userData.phase = Math.random() * Math.PI * 2;
  return root;
}

// ---------- Megacity: Mega Tower ----------
// Three flavors picked at random — gives Megacity a real skyline.
const MEGATOWER_PALETTES = [
  { wall: 0x3a4f72, lit: 0xbfe6ff, dark: 0x1a2540, accent: 0xff5a3a },
  { wall: 0x5a4248, lit: 0xffd29a, dark: 0x301a22, accent: 0xffd24a },
  { wall: 0x2c2c34, lit: 0xe0f4ff, dark: 0x14141a, accent: 0x66e6ff },
];
function megaWindowTexture(p) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#' + p.wall.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 6; x++) {
      const lit = Math.random() < 0.6;
      ctx.fillStyle = lit
        ? '#' + p.lit.toString(16).padStart(6, '0')
        : '#' + p.dark.toString(16).padStart(6, '0');
      ctx.fillRect(4 + x * 10, 4 + y * 6, 7, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildMegaTower(variant = 'spire') {
  const root = new THREE.Group();
  const p = MEGATOWER_PALETTES[Math.floor(Math.random() * MEGATOWER_PALETTES.length)];

  let w = 8 + Math.random() * 3;
  let d = 8 + Math.random() * 3;
  let h = 0;

  if (variant === 'spire') {
    // Tall narrow tapered tower with an antenna
    h = 50 + Math.random() * 18;
    const tex = megaWindowTexture(p);
    tex.repeat.set(2, Math.round(h / 4));
    const winMat = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex,
      emissive: 0xffffff, emissiveIntensity: 1.0,
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: p.wall });
    // Base block
    const baseH = h * 0.5;
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, baseH, d),
      [winMat, winMat, roofMat, roofMat, winMat, winMat],
    );
    baseMesh.position.y = baseH / 2;
    baseMesh.castShadow = true;
    root.add(baseMesh);
    // Upper narrower block
    const upH = h * 0.4;
    const upW = w * 0.7;
    const upD = d * 0.7;
    const upMesh = new THREE.Mesh(
      new THREE.BoxGeometry(upW, upH, upD),
      [winMat, winMat, roofMat, roofMat, winMat, winMat],
    );
    upMesh.position.y = baseH + upH / 2;
    upMesh.castShadow = true;
    root.add(upMesh);
    // Antenna mast
    const antennaH = h * 0.35;
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.3, antennaH, 8),
      new THREE.MeshLambertMaterial({ color: 0x88aaff, emissive: 0x6699ff, emissiveIntensity: 0.6 }),
    );
    ant.position.y = baseH + upH + antennaH / 2;
    root.add(ant);
    // Beacon at the very top
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 10, 8),
      new THREE.MeshBasicMaterial({ color: p.accent }),
    );
    beacon.position.y = baseH + upH + antennaH + 0.4;
    root.add(beacon);
    root.userData.beacon = beacon;
  } else if (variant === 'twin') {
    // Twin-pronged top — two tall slabs joined at the bottom
    h = 45 + Math.random() * 12;
    const tex = megaWindowTexture(p);
    tex.repeat.set(2, Math.round(h / 4));
    const winMat = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex,
      emissive: 0xffffff, emissiveIntensity: 1.0,
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: p.wall });
    // Joined lower block
    const baseH = h * 0.6;
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.4, baseH, d),
      [winMat, winMat, roofMat, roofMat, winMat, winMat],
    );
    baseMesh.position.y = baseH / 2;
    baseMesh.castShadow = true;
    root.add(baseMesh);
    // Two prongs above
    const prongH = h * 0.55;
    for (const sign of [-1, 1]) {
      const prong = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.55, prongH, d * 0.85),
        [winMat, winMat, roofMat, roofMat, winMat, winMat],
      );
      prong.position.set(sign * w * 0.4, baseH + prongH / 2, 0);
      prong.castShadow = true;
      root.add(prong);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.62, 0.5, d * 0.95),
        new THREE.MeshLambertMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: 0.5 }),
      );
      cap.position.set(sign * w * 0.4, baseH + prongH + 0.25, 0);
      root.add(cap);
    }
  } else { // 'pyramid'
    // Wide base, pyramidal cap
    h = 42 + Math.random() * 10;
    w *= 1.1; d *= 1.1;
    const tex = megaWindowTexture(p);
    tex.repeat.set(3, Math.round(h / 4));
    const winMat = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex,
      emissive: 0xffffff, emissiveIntensity: 1.0,
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: p.wall });
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      [winMat, winMat, roofMat, roofMat, winMat, winMat],
    );
    body.position.y = h / 2;
    body.castShadow = true;
    root.add(body);
    // Pyramid roof
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.62, h * 0.18, 4),
      new THREE.MeshLambertMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: 0.6 }),
    );
    cap.rotation.y = Math.PI / 4;
    cap.position.y = h + h * 0.09;
    root.add(cap);
    // Spire on top
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.32, 5, 8),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    spire.position.y = h + h * 0.18 + 2.5;
    root.add(spire);
  }

  root.userData.kind = 'building';
  root.userData.height = h;
  root.userData.radius = Math.max(w, d) * 0.5;
  root.userData.toughness = 1.5; // big!
  root.userData.score = 500; // 10× a normal building
  root.userData.falling = false;
  root.userData.subtype = 'megatower';
  return root;
}

// ---------- Military: Bunker ----------
export function buildBunker() {
  const root = new THREE.Group();
  const concrete = 0x6a6a5a;
  const dark = 0x3a3a2a;
  const sandbag = 0xa49070;
  // Half-buried concrete dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    FLAT(concrete),
  );
  dome.scale.set(1.3, 0.7, 1.6);
  dome.position.y = 0.2;
  dome.castShadow = true;
  root.add(dome);
  // Concrete skirt at the base
  const skirt = box(3.5, 0.4, 4.2, dark);
  skirt.position.y = 0.2;
  root.add(skirt);
  // Slit observation window (dark front strip)
  const slit = box(2.0, 0.18, 0.05, 0x111111);
  slit.position.set(0, 1.05, -2.05);
  root.add(slit);
  // Steel door at the back
  const door = box(0.8, 1.1, 0.06, 0x3a3a3a);
  door.position.set(0, 0.75, 1.95);
  root.add(door);
  // Sandbags piled on top
  for (let i = 0; i < 5; i++) {
    const bag = box(0.55, 0.22, 0.32, sandbag);
    const ang = (i / 5) * Math.PI * 2;
    bag.position.set(Math.cos(ang) * 1.5, 1.55, Math.sin(ang) * 1.6);
    bag.rotation.y = ang;
    root.add(bag);
  }
  // Antenna
  const ant = box(0.06, 1.4, 0.06, 0x222222);
  ant.position.set(0.5, 2.3, 0.5);
  root.add(ant);

  root.userData.kind = 'building';
  root.userData.size = 2.8;
  root.userData.radius = 2.5;
  root.userData.score = 75;
  root.userData.subtype = 'bunker';
  return root;
}

// ---------- Military: Guard Tower ----------
export function buildGuardTower() {
  const root = new THREE.Group();
  const wood = 0x5a4a32;
  const olive = 0x4a5a32;
  const dark = 0x3a3024;
  // Four stilt legs
  for (const [x, z] of [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]]) {
    const leg = box(0.2, 5.0, 0.2, wood);
    leg.position.set(x, 2.5, z);
    root.add(leg);
  }
  // Cross bracing
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const brace = box(2.4, 0.12, 0.12, wood);
    brace.position.y = 2.0;
    brace.position.x = Math.cos(ang) * 1.0;
    brace.position.z = Math.sin(ang) * 1.0;
    brace.rotation.y = ang;
    root.add(brace);
  }
  // Watch platform floor
  const floor = box(2.6, 0.18, 2.6, dark);
  floor.position.y = 5.0;
  root.add(floor);
  // Walls (low so guard's torso would be visible — open top half)
  for (let i = 0; i < 4; i++) {
    const wall = box(2.6, 1.2, 0.14, olive);
    wall.position.y = 5.7;
    const ang = (i / 4) * Math.PI * 2;
    wall.position.x = Math.cos(ang) * 1.3;
    wall.position.z = Math.sin(ang) * 1.3;
    wall.rotation.y = ang;
    root.add(wall);
  }
  // Pitched roof — two triangles
  const roofL = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.12, 1.6),
    FLAT(dark),
  );
  roofL.position.set(0, 7.0, 0.7);
  roofL.rotation.x = -0.4;
  root.add(roofL);
  const roofR = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.12, 1.6),
    FLAT(dark),
  );
  roofR.position.set(0, 7.0, -0.7);
  roofR.rotation.x = 0.4;
  root.add(roofR);
  // Spotlight
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0 }),
  );
  light.position.set(1.2, 6.4, 1.2);
  root.add(light);
  // Antenna
  const ant = box(0.05, 1.4, 0.05, 0x222222);
  ant.position.set(0, 7.8, 0);
  root.add(ant);

  root.userData.kind = 'building';
  root.userData.size = 2.4;
  root.userData.radius = 2.0;
  root.userData.score = 90;
  root.userData.subtype = 'guardTower';
  return root;
}

// ---------- Military: Hangar ----------
export function buildHangar() {
  const root = new THREE.Group();
  const olive = 0x5a6a4a;
  const dark = 0x3a4a32;
  // Wide arched main body — approximate with a half-cylinder
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 12, 18, 1, true, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: olive, side: THREE.DoubleSide }),
  );
  body.rotation.z = Math.PI / 2;
  body.rotation.y = Math.PI;
  body.position.y = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  // Front wall
  const front = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 18, 0, Math.PI),
    FLAT(dark),
  );
  front.position.set(0, 0, -6);
  front.rotation.x = 0;
  root.add(front);
  // Back wall
  const back = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 18, 0, Math.PI),
    FLAT(dark),
  );
  back.position.set(0, 0, 6);
  back.rotation.y = Math.PI;
  root.add(back);
  // Big front doors (two panels)
  for (const sign of [-1, 1]) {
    const door = box(3.5, 3.0, 0.15, 0x44503a);
    door.position.set(sign * 1.8, 1.5, -6.05);
    root.add(door);
  }
  // White roof stripe (visible from above for visual interest)
  const stripe = box(0.6, 0.05, 12, 0xe0e0d0);
  stripe.position.set(0, 4.4, 0);
  root.add(stripe);

  root.userData.kind = 'building';
  root.userData.size = 6.0;
  root.userData.radius = 6.5;
  root.userData.score = 180;
  root.userData.subtype = 'hangar';
  return root;
}

// ---------- Military: Fuel Tank ----------
export function buildFuelTank() {
  const root = new THREE.Group();
  // Wide white cylinder
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 3.0, 18),
    FLAT(0xeae2d0),
  );
  body.position.y = 1.5;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  // Red hazard stripe
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.62, 1.62, 0.4, 18, 1, true),
    FLAT(0xc0381a),
  );
  stripe.position.y = 1.5;
  root.add(stripe);
  // Top cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.55, 0.3, 18),
    FLAT(0x9a948a),
  );
  cap.position.y = 3.15;
  root.add(cap);
  // Pipes / valves on top
  const pipe1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.8, 8),
    FLAT(0x5a5a5a),
  );
  pipe1.position.set(0.6, 3.65, 0);
  root.add(pipe1);
  const valve = box(0.35, 0.2, 0.35, 0xc04030);
  valve.position.set(0.6, 4.15, 0);
  root.add(valve);
  // Skull-and-bones hazard placard
  const placard = box(0.6, 0.6, 0.05, 0xf0c020);
  placard.position.set(0, 1.5, 1.65);
  root.add(placard);

  root.userData.kind = 'building';
  root.userData.size = 2.0;
  root.userData.radius = 1.8;
  root.userData.score = 100;
  root.userData.subtype = 'fuelTank';
  return root;
}

// ---------- Military: Sandbag Wall ----------
export function buildSandbagWall(length = 4) {
  const root = new THREE.Group();
  const sandbag = 0xa49070;
  // Two rows of sandbags stacked
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < length; i++) {
      const bag = box(0.7, 0.32, 0.45, sandbag);
      bag.position.set(
        (i - (length - 1) / 2) * 0.72 + (row * 0.36),
        0.16 + row * 0.32,
        0,
      );
      bag.rotation.y = (Math.random() - 0.5) * 0.15;
      root.add(bag);
    }
  }

  root.userData.kind = 'building';
  root.userData.size = length * 0.4;
  root.userData.radius = length * 0.4;
  root.userData.score = 30 + length * 6;
  root.userData.subtype = 'sandbagWall';
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
    new THREE.CylinderGeometry(1.8, 2.8, 8.5, 24, 8, true),
    FLAT(concrete)
  );
  tower.position.y = 4.25;
  tower.castShadow = true;
  tower.receiveShadow = true;
  root.add(tower);
  // Top rim
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.85, 1.85, 0.25, 24),
    FLAT(0x8a847a)
  );
  rim.position.y = 8.5;
  root.add(rim);
  // Animated steam — independent puffs that rise + expand + fade in a loop
  const puffs = [];
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 7),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    puff.position.set(
      (Math.random() - 0.5) * 0.6,
      8.7 + i * 0.4,
      (Math.random() - 0.5) * 0.6,
    );
    puff.userData.life = i * 0.5;
    puff.userData.baseScale = 1.0;
    root.add(puff);
    puffs.push(puff);
  }

  root.userData.kind = 'building';
  root.userData.size = 5.0;
  root.userData.score = 150;
  root.userData.health = 1;
  root.userData.subtype = 'coolingTower';
  root.userData.steamPuffs = puffs;
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

// ---------- Military: Runway ----------
// A long flat strip with a center dashed line, threshold markings at
// both ends, and shoulder paint. Decoration only — not toppleable.
export function buildRunway(length = 80, width = 14) {
  const root = new THREE.Group();
  // Asphalt slab
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshLambertMaterial({ color: 0x202428 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.04;
  asphalt.receiveShadow = true;
  root.add(asphalt);
  // White centerline dashes
  const dashCount = Math.floor(length / 5);
  for (let i = 0; i < dashCount; i++) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 2.0),
      new THREE.MeshBasicMaterial({ color: 0xeae8d0 }),
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.05, -length / 2 + 2.5 + i * 5);
    root.add(dash);
  }
  // Side white shoulder lines
  for (const xx of [-width / 2 + 0.4, width / 2 - 0.4]) {
    const side = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, length),
      new THREE.MeshBasicMaterial({ color: 0xeae8d0 }),
    );
    side.rotation.x = -Math.PI / 2;
    side.position.set(xx, 0.05, 0);
    root.add(side);
  }
  // Threshold "piano keys" at each end
  for (const endZ of [-length / 2 + 1.5, length / 2 - 1.5]) {
    for (let i = -3; i <= 3; i++) {
      const key = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 2.5),
        new THREE.MeshBasicMaterial({ color: 0xeae8d0 }),
      );
      key.rotation.x = -Math.PI / 2;
      key.position.set(i * 1.3, 0.06, endZ);
      root.add(key);
    }
  }

  root.userData.kind = 'runway';
  return root;
}

// ---------- Military: Road (connector strip) ----------
export function buildRoad(length = 30, width = 4) {
  const root = new THREE.Group();
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshLambertMaterial({ color: 0x35383d }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.035;
  asphalt.receiveShadow = true;
  root.add(asphalt);
  // Yellow centerline dashes
  const dashCount = Math.floor(length / 4);
  for (let i = 0; i < dashCount; i++) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 1.5),
      new THREE.MeshBasicMaterial({ color: 0xd9c24a }),
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.045, -length / 2 + 2 + i * 4);
    root.add(dash);
  }
  root.userData.kind = 'road';
  return root;
}

// ---------- Lava Throne: Lava Pool (hazard + visual) ----------
export function buildLavaPool() {
  const root = new THREE.Group();
  // High-segment disc so the edge doesn't read as faceted polygon
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 48),
    new THREE.MeshLambertMaterial({
      color: 0xff7a2a,
      emissive: 0xff5a1a,
      emissiveIntensity: 1.4,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.05;
  root.add(pool);
  // Darker crust ring around the edge
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.2, 48),
    new THREE.MeshLambertMaterial({ color: 0x2a0a04, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  root.add(ring);
  // Bright inner pool that pulses — readable as molten hot center
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 36),
    new THREE.MeshBasicMaterial({
      color: 0xffd8a0,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.07;
  root.add(core);
  // Rising ember sparks (small glowing cones that float up + fade, looped)
  const embers = [];
  for (let i = 0; i < 8; i++) {
    const em = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 5),
      new THREE.MeshBasicMaterial({
        color: 0xffc070,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    em.position.set(
      (Math.random() - 0.5) * 4.0,
      Math.random() * 4.0,
      (Math.random() - 0.5) * 4.0,
    );
    em.userData.life = Math.random() * 3;
    root.add(em);
    embers.push(em);
  }

  root.userData.kind = 'lava';
  root.userData.size = 4.0;
  root.userData.core = core;
  root.userData.embers = embers;
  root.userData.phase = Math.random() * Math.PI * 2;
  return root;
}

// ---------- Spawning ----------

export function spawnLandmarks(scene, level, playerPos) {
  const group = new THREE.Group();
  group.userData.kind = 'landmarks';

  if (level.harbor) {
    // Spawn a guaranteed cluster around the player so at least one is
    // visible from spawn, then a scatter farther out for skyline depth.
    const HARBOR_RIG_SCALE = 1.5;
    const startAngles = [0, Math.PI * 0.4, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 1.7];
    for (let i = 0; i < startAngles.length; i++) {
      const rig = buildOilRig();
      rig.scale.setScalar(HARBOR_RIG_SCALE);
      const ang = startAngles[i] + (Math.random() - 0.5) * 0.3;
      const dist = 16 + Math.random() * 8; // close enough to spot from spawn
      const x = playerPos.x + Math.cos(ang) * dist;
      const z = playerPos.z + Math.sin(ang) * dist;
      rig.position.set(x, getHeightAt(x, z), z);
      rig.rotation.y = Math.random() * Math.PI * 2;
      group.add(rig);
    }
    // Plus a few farther out for horizon detail
    for (let i = 0; i < 4; i++) {
      const rig = buildOilRig();
      rig.scale.setScalar(HARBOR_RIG_SCALE);
      addAround(group, rig, playerPos, 35, 75);
    }
    // Giant water plane around the playable area. Sits just below ground
    // level so buildings + oil rigs poke through the surface.
    const water = buildWaterRect(PLAYABLE_RADIUS * 2.6, PLAYABLE_RADIUS * 2.6, 96, 96);
    water.position.y = 0.18;
    water.userData.kind = 'water'; // skip in consume paths via subtype filter
    group.add(water);
  }
  if (level.military) {
    // Anchor the base with one big runway running N/S right past spawn.
    // Random rotation so each session reads slightly different.
    const runwayRot = (Math.random() < 0.5 ? 0 : Math.PI / 2);
    const runwayCx = playerPos.x + Math.cos(runwayRot + Math.PI / 2) * 18;
    const runwayCz = playerPos.z + Math.sin(runwayRot + Math.PI / 2) * 18;
    const runway = buildRunway(80, 14);
    runway.position.set(runwayCx, getHeightAt(runwayCx, runwayCz), runwayCz);
    runway.rotation.y = runwayRot;
    group.add(runway);

    // Two parked fuel tanks beside the runway
    for (let i = 0; i < 2; i++) {
      const tank = buildFuelTank();
      const lateralOff = (i === 0 ? -1 : 1) * 9;
      const longOff = -20 + i * 12;
      const tx = runwayCx + Math.cos(runwayRot) * lateralOff + Math.cos(runwayRot + Math.PI / 2) * longOff;
      const tz = runwayCz + Math.sin(runwayRot) * lateralOff + Math.sin(runwayRot + Math.PI / 2) * longOff;
      tank.position.set(tx, getHeightAt(tx, tz), tz);
      group.add(tank);
    }

    // A hangar at one end of the runway
    const hangar = buildHangar();
    const hangarOff = 36;
    const hx = runwayCx + Math.cos(runwayRot + Math.PI / 2) * hangarOff;
    const hz = runwayCz + Math.sin(runwayRot + Math.PI / 2) * hangarOff;
    hangar.position.set(hx, getHeightAt(hx, hz), hz);
    hangar.rotation.y = runwayRot;
    group.add(hangar);

    // A second hangar at the other end (rotated)
    const hangar2 = buildHangar();
    const h2x = runwayCx + Math.cos(runwayRot + Math.PI / 2) * -hangarOff;
    const h2z = runwayCz + Math.sin(runwayRot + Math.PI / 2) * -hangarOff;
    hangar2.position.set(h2x, getHeightAt(h2x, h2z), h2z);
    hangar2.rotation.y = runwayRot + Math.PI;
    group.add(hangar2);

    // Connector roads in a + pattern from spawn
    for (const ang of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const road = buildRoad(40, 4.5);
      const rx = playerPos.x + Math.cos(ang) * 30;
      const rz = playerPos.z + Math.sin(ang) * 30;
      road.position.set(rx, getHeightAt(rx, rz), rz);
      road.rotation.y = ang;
      group.add(road);
    }

    // 4 guard towers at the perimeter — corner placement
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tower = buildGuardTower();
      const tx = playerPos.x + dx * 42;
      const tz = playerPos.z + dz * 42;
      tower.position.set(tx, getHeightAt(tx, tz), tz);
      tower.rotation.y = Math.atan2(-dx, -dz);
      group.add(tower);
    }

    // 5 bunkers scattered around the base
    for (let i = 0; i < 5; i++) {
      addAround(group, buildBunker(), playerPos, 20, 55);
    }

    // 4 radar dishes (was the only thing here before)
    for (let i = 0; i < 4; i++) {
      addAround(group, buildRadarDish(), playerPos, 18, 60);
    }

    // Sandbag walls around the perimeter — 6 short walls at varied angles
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 28 + Math.random() * 18;
      const sx = playerPos.x + Math.cos(ang) * dist;
      const sz = playerPos.z + Math.sin(ang) * dist;
      const wall = buildSandbagWall(3 + Math.floor(Math.random() * 3));
      wall.position.set(sx, getHeightAt(sx, sz), sz);
      wall.rotation.y = ang + Math.PI / 2; // wall faces tangentially
      group.add(wall);
    }
  }
  if (level.powerPlant) {
    for (let i = 0; i < 4; i++) addAround(group, buildCoolingTower(), playerPos, 22, 65);
    for (let i = 0; i < 5; i++) addAround(group, buildReactorCore(), playerPos, 14, 50);
  }
  if (level.lavaThrone) {
    for (let i = 0; i < 8; i++) addAround(group, buildLavaPool(), playerPos, 10, 75);
  }
  if (level.megacity) {
    // 4-6 iconic megatowers — these read as the city skyline. Placed
    // farther from spawn so the player chases them down on foot.
    const variants = ['spire', 'twin', 'pyramid'];
    for (let i = 0; i < 5; i++) {
      const v = variants[i % variants.length];
      addAround(group, buildMegaTower(v), playerPos, 35, 80);
    }
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
  const now = performance.now() * 0.001;
  for (const obj of group.children) {
    const u = obj.userData;
    if (u.kind === 'reactor' && u.rod) {
      u.rod.material.emissiveIntensity = 1.2 + Math.sin(now * 5) * 0.5;
      obj.rotation.y += dt * 0.3;
    } else if (u.subtype === 'radar' && u.dish) {
      u.dish.rotation.z += dt * 0.4;
    } else if (u.subtype === 'oilRig' && u.flameLayers) {
      // Flicker the flame layers — independent scales + opacities
      u.phase += dt * 6;
      for (let i = 0; i < u.flameLayers.length; i++) {
        const fl = u.flameLayers[i];
        const flicker = 1 + Math.sin(u.phase + i * 1.3) * 0.18 + Math.random() * 0.08;
        fl.mesh.scale.y = flicker;
        fl.mat.opacity = (i === 0 ? 0.75 : i === 1 ? 0.85 : 0.95) + Math.sin(u.phase * 2 + i) * 0.1;
      }
      // Drift smoke up slowly + fade in/out
      for (let i = 0; i < u.smoke.length; i++) {
        const puff = u.smoke[i];
        puff.position.y += dt * 0.5;
        puff.material.opacity = Math.max(0, 0.4 - (puff.position.y - 8.4 - i * 0.6) * 0.3);
        if (puff.position.y > 11.5) puff.position.y = 8.4 + i * 0.6;
      }
    } else if (u.subtype === 'coolingTower' && u.steamPuffs) {
      // Each puff rises, expands, fades, then loops back to the rim
      for (const puff of u.steamPuffs) {
        puff.userData.life += dt * 0.6;
        const life = puff.userData.life % 4;
        const t = life / 4;
        puff.position.y = 8.7 + life * 1.2;
        const s = 1.0 + life * 0.8;
        puff.scale.setScalar(s);
        puff.material.opacity = Math.sin(t * Math.PI) * 0.7;
      }
    } else if (u.kind === 'lava' && u.embers) {
      // Pulse the bright inner core
      if (u.core) u.core.material.opacity = 0.5 + Math.sin(now * 2.5) * 0.18;
      // Rise + fade the ember sparks
      for (const em of u.embers) {
        em.userData.life += dt;
        if (em.userData.life > 3) {
          em.userData.life = 0;
          em.position.x = (Math.random() - 0.5) * 4.0;
          em.position.z = (Math.random() - 0.5) * 4.0;
          em.position.y = 0.2;
        }
        em.position.y += dt * 1.2;
        em.material.opacity = Math.max(0, 1 - em.userData.life / 3) * 0.9;
      }
    } else if (u.subtype === 'megatower' && u.beacon) {
      // Beacon blink for spire variant
      u.beacon.material.color.setHex(
        Math.sin(now * 2) > 0 ? 0xff5a3a : 0x441010
      );
    }
  }
}
