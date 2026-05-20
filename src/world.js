import * as THREE from 'three';
import { buildTree, buildCactus, buildRock, buildPlant } from './dinos.js';

export const WORLD_SIZE = 120; // half-extent

// Biome lookup based on world coords.
// Forest = north (-Z), Swamp = east (+X), Desert = south/west.
export function biomeAt(x, z) {
  if (z < -20) return 'forest';
  if (x > 25) return 'swamp';
  return 'desert';
}

const BIOME_COLORS = {
  forest: 0x5fae5c,
  swamp:  0x4a7a5a,
  desert: 0xd4b070,
};

/**
 * Smooth rolling-hills height function. Sampled by the ground geometry
 * AND by entities so everything sits on the same terrain.
 *
 * Multiple sine waves at different scales = pseudo-noise without needing
 * a real noise library. Amplitude kept modest so gameplay isn't disrupted.
 */
export function getHeightAt(x, z) {
  // Large slow hills
  let h = Math.sin(x * 0.035) * 1.6 + Math.cos(z * 0.04) * 1.4;
  // Medium-scale ridges
  h += Math.sin((x + z) * 0.06) * 0.7;
  h += Math.cos((x - z) * 0.055) * 0.6;
  // Small detail bumps
  h += Math.sin(x * 0.18) * 0.25 + Math.cos(z * 0.2) * 0.25;
  return h;
}

/**
 * Build the world: ground (multi-biome, with hills), trees, rocks, plants.
 * Returns { ground, decorations, plants }.
 */
export function buildWorld(scene) {
  // Higher segment count so hills look smooth
  const segs = 120;
  const geom = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, segs, segs);
  geom.rotateX(-Math.PI / 2);
  const colors = [];
  const pos = geom.attributes.position;
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const b = biomeAt(x, z);
    // Biome blend near borders for softer transitions
    color.setHex(BIOME_COLORS[b]);
    const variation = 0.85 + Math.random() * 0.3; // tonal noise per vertex
    color.r *= variation;
    color.g *= variation;
    color.b *= variation;
    pos.setY(i, getHeightAt(x, z));
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

  // Forest trees
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const z = -20 - Math.random() * (WORLD_SIZE - 20);
    if (Math.hypot(x, z) < 8) continue;
    const t = buildTree();
    t.position.set(x, getHeightAt(x, z), z);
    t.scale.setScalar(0.8 + Math.random() * 0.6);
    t.rotation.y = Math.random() * Math.PI * 2;
    decorations.add(t);
  }

  // Swamp trees (taller, sparser)
  for (let i = 0; i < 30; i++) {
    const x = 25 + Math.random() * (WORLD_SIZE - 25);
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const t = buildTree();
    t.position.set(x, getHeightAt(x, z), z);
    t.scale.setScalar(1.0 + Math.random() * 0.4);
    t.rotation.y = Math.random() * Math.PI * 2;
    decorations.add(t);
  }

  // Desert cacti
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    if (biomeAt(x, z) !== 'desert') continue;
    if (Math.hypot(x, z) < 8) continue;
    const c = buildCactus();
    c.position.set(x, getHeightAt(x, z), z);
    c.scale.setScalar(0.8 + Math.random() * 0.5);
    decorations.add(c);
  }

  // Rocks scattered everywhere
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    if (Math.hypot(x, z) < 6) continue;
    const r = buildRock();
    r.position.set(x, getHeightAt(x, z), z);
    r.scale.setScalar(0.6 + Math.random() * 1.2);
    decorations.add(r);
  }

  // Edible plants
  const plants = new THREE.Group();
  scene.add(plants);
  for (let i = 0; i < 120; i++) {
    spawnPlantRandom(plants);
  }

  // Sky + clouds
  buildSky(scene);
  const clouds = buildClouds(scene);

  return { ground, decorations, plants, clouds };
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
 * Goes from warm horizon to deep zenith.
 */
function buildSky(scene) {
  const geom = new THREE.SphereGeometry(450, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x3b6fb0) },
      midColor:    { value: new THREE.Color(0x9cd3ff) },
      bottomColor: { value: new THREE.Color(0xffd8a8) },
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
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        // Map y from [-1,1] to a smoother gradient with a warm horizon band
        float horizonGlow = smoothstep(-0.05, 0.15, h) * (1.0 - smoothstep(0.15, 0.45, h));
        vec3 sky = mix(bottomColor, midColor, smoothstep(-0.1, 0.4, h));
        sky = mix(sky, topColor, smoothstep(0.3, 0.85, h));
        // Add a warm horizon glow
        sky += vec3(0.18, 0.12, 0.04) * horizonGlow;
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
 * Chunky low-poly clouds — clusters of overlapping spheres painted white.
 * Returns a Group so the main loop can drift them slowly.
 */
function buildClouds(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.15,
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
