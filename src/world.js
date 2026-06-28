import * as THREE from 'three';
import {
  buildTree, buildCactus, buildRock, buildPlant,
  buildPalmTree, buildFern,
} from './dinos.js';
import { getLevel } from './levels.js';

export const WORLD_SIZE = 120;       // half-extent of the visible ground
export const PLAYABLE_RADIUS = 100;  // player + entities clamp inside this — mountains start at 90

// Biome lookup based on world coords.
// Forest = north (-Z), Swamp = east (+X), Desert = south/west.
export function biomeAt(x, z) {
  if (z < -20) return 'forest';
  if (x > 25) return 'swamp';
  return 'desert';
}

/**
 * Smooth rolling-hills height function. Sampled by the ground geometry
 * AND by entities so everything sits on the same terrain.
 *
 * Multiple sine waves at different scales = pseudo-noise without needing
 * a real noise library. Amplitude kept modest so gameplay isn't disrupted.
 */
export function getHeightAt(x, z) {
  const level = getLevel();
  let h;
  if (level && level.flat) {
    h = 0; // city levels are flat so streets and buildings sit level
  } else {
    // Large slow hills
    h = Math.sin(x * 0.035) * 1.6 + Math.cos(z * 0.04) * 1.4;
    // Medium-scale ridges
    h += Math.sin((x + z) * 0.06) * 0.7;
    h += Math.cos((x - z) * 0.055) * 0.6;
    // Small detail bumps
    h += Math.sin(x * 0.18) * 0.25 + Math.cos(z * 0.2) * 0.25;
  }
  // Boundary mountains: terrain ramps up beyond dist 90, so the world
  // edges feel like distant mountains rather than a drop-off.
  const edgeDist = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - 90);
  if (edgeDist > 0) {
    h += edgeDist * edgeDist * 0.04;
  }

  // Per-level central peak (e.g. the volcano on Dino Park)
  const peak = level && level.centerPeak;
  if (peak) {
    const dx = x - peak.x;
    const dz = z - peak.z;
    const d = Math.hypot(dx, dz);
    if (d < peak.radius) {
      // Smooth cone: high in the middle, ramping down toward the radius
      const t = 1 - d / peak.radius;
      h += peak.height * t * t * (3 - 2 * t); // smoothstep curve
    }
  }
  return h;
}

/**
 * Build the world: ground (multi-biome, with hills), trees, rocks, plants.
 * Returns { ground, decorations, plants }.
 */
export function buildWorld(scene) {
  const level = getLevel();
  // Higher segment count so hills look smooth
  const segs = 120;
  const geom = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, segs, segs);
  geom.rotateX(-Math.PI / 2);
  const colors = [];
  const pos = geom.attributes.position;
  const color = new THREE.Color();
  // Rocky tint applied to high-elevation vertices for mountains/peaks
  const rockColor = new THREE.Color(level.mountainColor != null ? level.mountainColor : 0x6a6660);
  const snowColor = new THREE.Color(0xf0f4f8);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const b = biomeAt(x, z);
    color.setHex(level.biomeColors[b]);
    const variation = 0.85 + Math.random() * 0.3;
    color.r *= variation;
    color.g *= variation;
    color.b *= variation;
    const y = getHeightAt(x, z);
    pos.setY(i, y);
    // Blend toward rock above ~5 units, toward snow above ~20 units
    if (y > 5) {
      const rockT = Math.min(1, (y - 5) / 12);
      color.lerp(rockColor, rockT * 0.85);
    }
    if (y > 20 && level.snowyPeaks !== false) {
      const snowT = Math.min(1, (y - 20) / 10);
      color.lerp(snowColor, snowT * 0.75);
    }
    colors.push(color.r, color.g, color.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true, // low-poly faceted look
  });
  const ground = new THREE.Mesh(geom, mat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Decorations
  const decorations = new THREE.Group();
  scene.add(decorations);

  const tropical = !!level.tropicalTrees;
  // City levels skip natural foliage — buildings (added by main.js) fill it in.
  // Aquatic levels (Harbor) skip it too — open water has no trees or grass.
  const naturalFoliage = !level.city && !level.aquatic;

  // Forest / jungle trees — palms for tropical levels, normal trees otherwise
  for (let i = 0; naturalFoliage && i < 110; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.95;
    const z = -20 - Math.random() * (WORLD_SIZE - 10);
    if (Math.hypot(x, z) < 8) continue;
    const t = tropical ? buildPalmTree() : buildTree();
    t.position.set(x, getHeightAt(x, z), z);
    t.scale.setScalar(0.8 + Math.random() * 0.6);
    t.rotation.y = Math.random() * Math.PI * 2;
    decorations.add(t);
  }

  // Swamp trees (taller, sparser) — also use palms on tropical
  for (let i = 0; naturalFoliage && i < 40; i++) {
    const x = 25 + Math.random() * (WORLD_SIZE - 15);
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.95;
    const t = tropical ? buildPalmTree() : buildTree();
    t.position.set(x, getHeightAt(x, z), z);
    t.scale.setScalar(1.0 + Math.random() * 0.4);
    t.rotation.y = Math.random() * Math.PI * 2;
    decorations.add(t);
  }

  // Desert / beach decorations
  for (let i = 0; naturalFoliage && i < 40; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.95;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.95;
    if (biomeAt(x, z) !== 'desert') continue;
    if (Math.hypot(x, z) < 8) continue;
    // Tropical desert = beach: sprinkle a few palms here too instead of cacti
    const obj = tropical ? buildPalmTree() : buildCactus();
    obj.position.set(x, getHeightAt(x, z), z);
    obj.scale.setScalar(0.8 + Math.random() * 0.5);
    decorations.add(obj);
  }

  // Ferns on tropical levels — ground cover under the canopy
  if (tropical && naturalFoliage) {
    for (let i = 0; i < 80; i++) {
      const x = (Math.random() - 0.5) * WORLD_SIZE * 1.9;
      const z = (Math.random() - 0.5) * WORLD_SIZE * 1.9;
      if (Math.hypot(x, z) < 6) continue;
      // Mostly in the jungle/swamp zones
      const b = biomeAt(x, z);
      if (b === 'desert' && Math.random() > 0.2) continue;
      const f = buildFern();
      f.position.set(x, getHeightAt(x, z), z);
      f.scale.setScalar(0.7 + Math.random() * 0.6);
      f.rotation.y = Math.random() * Math.PI * 2;
      decorations.add(f);
    }
  }

  // Rocks — scatter everywhere AND clump heavily in the boundary mountains.
  // Aquatic levels get only a few rocks as reef accents, no inland scatter.
  const rockCount = level.aquatic ? 12 : 80;
  for (let i = 0; i < rockCount; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.95;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.95;
    if (Math.hypot(x, z) < 6) continue;
    const r = buildRock();
    r.position.set(x, getHeightAt(x, z), z);
    r.scale.setScalar(0.6 + Math.random() * 1.2);
    decorations.add(r);
  }
  // Extra rocks clinging to the boundary mountain slopes — skip on aquatic
  if (!level.aquatic) {
    for (let i = 0; i < 80; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 92 + Math.random() * 25;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const r = buildRock();
      r.position.set(x, getHeightAt(x, z), z);
      r.scale.setScalar(1.0 + Math.random() * 2.0);
      decorations.add(r);
    }
  }

  // Edible plants — skipped on aquatic levels (no grass in the ocean)
  const plants = new THREE.Group();
  scene.add(plants);
  if (!level.aquatic) {
    for (let i = 0; i < 120; i++) {
      spawnPlantRandom(plants);
    }
  }

  // Sky + clouds (no clouds in vacuum)
  const sky = buildSky(scene);
  let clouds = null;
  if (level.moon) {
    // Moon level: deep-space backdrop instead of fluffy clouds
    buildStarField(scene);
    buildEarth(scene);
  } else {
    clouds = buildClouds(scene);
  }

  return { ground, decorations, plants, clouds, sky };
}

/**
 * Procedural star field — 1800 points scattered on the upper hemisphere
 * of a large sphere. Renders as bright pixels that never fade with
 * distance so they read as stars at any zoom.
 */
function buildStarField(scene) {
  const STAR_COUNT = 1800;
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 400;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    // Mostly white, a few warm-tinted or blue
    const tint = Math.random();
    if (tint < 0.7) {
      colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
    } else if (tint < 0.85) {
      colors[i * 3] = 1; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.6;
    } else {
      colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1;
    }
    sizes[i] = 1.2 + Math.random() * 1.8;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({
    vertexColors: true,
    size: 2,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
  });
  const stars = new THREE.Points(geom, mat);
  stars.renderOrder = -1;
  scene.add(stars);
  return stars;
}

/**
 * The Earth — a textured sphere hanging high in the sky. Canvas-painted
 * with ocean, continents, polar caps, and cloud streaks. Slowly spins.
 */
function buildEarth(scene) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  // Ocean
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0a3a78');
  grad.addColorStop(0.5, '#1a5a9c');
  grad.addColorStop(1, '#0a3a78');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  // Continents (organic-ish blobs)
  const continents = [
    { x: 220, y: 180, r: 130, color: '#3a8a3a' },
    { x: 250, y: 320, r: 90, color: '#5a7a3a' },
    { x: 470, y: 200, r: 120, color: '#4a8a3a' },
    { x: 520, y: 320, r: 75, color: '#5a8a3a' },
    { x: 720, y: 230, r: 110, color: '#4a8a3a' },
    { x: 850, y: 340, r: 80, color: '#6a8a4a' },
    { x: 100, y: 350, r: 60, color: '#5a7a3a' },
    { x: 920, y: 180, r: 50, color: '#3a8a3a' },
  ];
  for (const c0 of continents) {
    ctx.fillStyle = c0.color;
    ctx.beginPath();
    const verts = 14;
    for (let v = 0; v < verts; v++) {
      const ang = (v / verts) * Math.PI * 2;
      const rr = c0.r * (0.65 + Math.random() * 0.55);
      const px = c0.x + Math.cos(ang) * rr;
      const py = c0.y + Math.sin(ang) * rr * 0.6;
      if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Polar caps
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, 0, 1024, 26);
  ctx.fillRect(0, 488, 1024, 24);
  // Cloud streaks (semi-transparent)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 1024;
    const y = 30 + Math.random() * 450;
    const w = 30 + Math.random() * 80;
    const h = 8 + Math.random() * 14;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(38, 36, 24),
    new THREE.MeshLambertMaterial({
      map: tex,
      emissive: 0x143360,
      emissiveIntensity: 0.4,
    }),
  );
  earth.position.set(140, 210, -270);
  earth.userData.spin = 0.04;
  earth.userData.isEarth = true;
  scene.add(earth);
  return earth;
}

export function spawnPlantRandom(plantsGroup) {
  const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  if (Math.hypot(x, z) < 4) return null;
  const p = buildPlant();
  p.position.set(x, getHeightAt(x, z), z);
  p.userData.kind = 'plant';
  p.userData.size = 0.4;
  p.userData.nutrition = 1;
  plantsGroup.add(p);
  return p;
}

/**
 * Gradient sky dome — large inverted sphere with a custom shader.
 * Reads top/mid/bottom/glow from the active level theme.
 */
function buildSky(scene) {
  const level = getLevel();
  const geom = new THREE.SphereGeometry(450, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(level.sky.top) },
      midColor:    { value: new THREE.Color(level.sky.mid) },
      bottomColor: { value: new THREE.Color(level.sky.bottom) },
      glow:        { value: new THREE.Vector3(...level.sky.glow) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform vec3 glow;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        float horizonGlow = smoothstep(-0.05, 0.15, h) * (1.0 - smoothstep(0.15, 0.45, h));
        vec3 sky = mix(bottomColor, midColor, smoothstep(-0.1, 0.4, h));
        sky = mix(sky, topColor, smoothstep(0.3, 0.85, h));
        sky += glow * horizonGlow;
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geom, mat);
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}

/**
 * Chunky low-poly clouds — clusters of overlapping spheres.
 * Color/emissive comes from the level theme (white for daytime, dark for
 * volcano ash, dim grey for night).
 */
function buildClouds(scene) {
  const level = getLevel();
  const group = new THREE.Group();
  scene.add(group);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: level.cloud.color,
    emissive: level.cloud.color,
    emissiveIntensity: level.cloud.emissive,
  });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const blobs = 4 + Math.floor(Math.random() * 4);
    for (let j = 0; j < blobs; j++) {
      const r = 2 + Math.random() * 2.5;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
      blob.position.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 4
      );
      blob.castShadow = false;
      cloud.add(blob);
    }
    // Place high in the sky, well above the player
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 80;
    cloud.position.set(
      Math.cos(ang) * dist,
      24 + Math.random() * 12,
      Math.sin(ang) * dist
    );
    cloud.userData.drift = 0.4 + Math.random() * 0.6;
    group.add(cloud);
  }
  return group;
}

export function animateClouds(group, dt) {
  for (const c of group.children) {
    c.position.x += c.userData.drift * dt;
    if (c.position.x > 180) c.position.x = -180;
  }
}

// Spin the Earth slowly on its axis if the moon level has one in scene.
export function animateMoonSky(scene, dt) {
  for (const o of scene.children) {
    if (o.userData && o.userData.isEarth) {
      o.rotation.y += (o.userData.spin || 0.04) * dt;
    }
  }
}
