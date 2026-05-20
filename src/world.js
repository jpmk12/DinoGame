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
 * Build the world: ground (multi-biome), trees, rocks, plants.
 * Returns { ground, decorations, plants } where plants is a Group of edible plants.
 */
export function buildWorld(scene) {
  // Multi-biome ground: a big plane with vertex colors based on biome.
  const segs = 60;
  const geom = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, segs, segs);
  geom.rotateX(-Math.PI / 2);
  const colors = [];
  const pos = geom.attributes.position;
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const b = biomeAt(x, z);
    color.setHex(BIOME_COLORS[b]);
    // Slight vertex jitter to break up flatness
    const n = (Math.sin(x * 0.3) + Math.cos(z * 0.3)) * 0.15;
    pos.setY(i, n);
    colors.push(color.r, color.g, color.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
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
    t.position.set(x, 0, z);
    t.scale.setScalar(0.8 + Math.random() * 0.6);
    t.rotation.y = Math.random() * Math.PI * 2;
    decorations.add(t);
  }

  // Swamp trees (taller, sparser)
  for (let i = 0; i < 30; i++) {
    const x = 25 + Math.random() * (WORLD_SIZE - 25);
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const t = buildTree();
    t.position.set(x, 0, z);
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
    c.position.set(x, 0, z);
    c.scale.setScalar(0.8 + Math.random() * 0.5);
    decorations.add(c);
  }

  // Rocks scattered everywhere
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.8;
    if (Math.hypot(x, z) < 6) continue;
    const r = buildRock();
    r.position.set(x, 0, z);
    r.scale.setScalar(0.6 + Math.random() * 1.2);
    decorations.add(r);
  }

  // Edible plants (separate group for collision)
  const plants = new THREE.Group();
  scene.add(plants);
  for (let i = 0; i < 120; i++) {
    spawnPlantRandom(plants);
  }

  return { ground, decorations, plants };
}

export function spawnPlantRandom(plantsGroup) {
  const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
  if (Math.hypot(x, z) < 4) return null;
  const p = buildPlant();
  p.position.set(x, 0, z);
  p.userData.kind = 'plant';
  p.userData.size = 0.4;
  p.userData.nutrition = 1;
  plantsGroup.add(p);
  return p;
}
