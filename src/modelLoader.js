import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SPECIES } from './dinos.js';

// Loads Quaternius (or any) .glb models from /models/, with a graceful
// fallback to the procedural builder if the file is missing.
// Models are loaded once and cloned per instance.

const loader = new GLTFLoader();
const modelCache = new Map();      // species -> THREE.Group (loaded GLB scene)
const modelMissing = new Set();    // species we've already 404'd on (don't retry)
const pendingLoads = new Map();    // species -> Promise

const MODELS_BASE = './models/';
const TARGET_LENGTH = 2.0; // normalize all dinos to ~2 units long at scale 1.0

/**
 * Eagerly preload all species' GLB models if present, in parallel.
 * Always resolves — missing files just get marked and fall back to procedural.
 */
export function preloadAllModels() {
  const promises = [];
  for (const key of Object.keys(SPECIES)) {
    promises.push(tryLoadModel(key));
  }
  return Promise.allSettled(promises);
}

function tryLoadModel(speciesKey) {
  if (modelCache.has(speciesKey)) return Promise.resolve(modelCache.get(speciesKey));
  if (modelMissing.has(speciesKey)) return Promise.resolve(null);
  if (pendingLoads.has(speciesKey)) return pendingLoads.get(speciesKey);

  const spec = SPECIES[speciesKey];
  if (!spec || !spec.modelFile) {
    modelMissing.add(speciesKey);
    return Promise.resolve(null);
  }

  const url = MODELS_BASE + spec.modelFile;
  const p = new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        normalizeModel(root, spec);
        modelCache.set(speciesKey, root);
        resolve(root);
      },
      undefined,
      (err) => {
        // 404 or other — silent fallback to procedural
        modelMissing.add(speciesKey);
        resolve(null);
      }
    );
  });
  pendingLoads.set(speciesKey, p);
  return p;
}

/**
 * Resize/recenter loaded model so it stands on y=0 with consistent forward (-Z)
 * orientation and roughly TARGET_LENGTH along its longest horizontal axis.
 */
function normalizeModel(root, spec) {
  // Apply shadow casting and tweak materials for the low-poly vibe
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Measure bounding box, scale to target length, drop feet to y=0
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.z) || size.y || 1;
  const s = TARGET_LENGTH / longest;
  root.scale.multiplyScalar(s);

  // Re-measure after scaling
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  // Move so feet sit on y=0 and center on x/z
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box2.min.y;
}

/**
 * Build a dino for a given species. Returns a Promise<THREE.Group>.
 * Uses the GLB if loaded, else falls back to the procedural builder.
 *
 * The returned group already has userData populated (kind, species, etc.)
 * by the caller — this just gives you the visual mesh.
 */
export async function createDinoMesh(speciesKey) {
  const spec = SPECIES[speciesKey];
  if (!spec) throw new Error(`Unknown species: ${speciesKey}`);

  const loaded = await tryLoadModel(speciesKey);
  if (loaded) {
    const inst = loaded.clone(true);
    inst.userData.fromGLB = true;
    inst.userData.parts = {}; // GLBs have no procedural parts; animation falls back to bob
    return inst;
  }
  // Procedural fallback
  const proc = spec.build(spec.color);
  proc.userData.fromGLB = false;
  return proc;
}

/**
 * Synchronous procedural-only build (used during initial scene setup before
 * preload finishes, and for instances where async is awkward).
 */
export function createDinoMeshSync(speciesKey) {
  const spec = SPECIES[speciesKey];
  if (!spec) throw new Error(`Unknown species: ${speciesKey}`);

  // If GLB is already cached, use it immediately
  if (modelCache.has(speciesKey)) {
    const inst = modelCache.get(speciesKey).clone(true);
    inst.userData.fromGLB = true;
    inst.userData.parts = {};
    return inst;
  }

  const proc = spec.build(spec.color);
  proc.userData.fromGLB = false;
  return proc;
}

export function modelStatus() {
  return {
    loaded: [...modelCache.keys()],
    missing: [...modelMissing],
    total: Object.keys(SPECIES).length,
  };
}
