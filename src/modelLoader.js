import * as THREE from 'three';
import { SPECIES } from './dinos.js';

// Loads Quaternius (or any) .glb models from /models/, with a graceful
// fallback to the procedural builder if the file is missing.
// Models are loaded once and cloned per instance.
//
// IMPORTANT: GLTFLoader is loaded dynamically the first time we need it,
// so a CDN issue with the loader cannot break the rest of the game.

let loaderPromise = null;
function getLoader() {
  if (!loaderPromise) {
    loaderPromise = import('three/addons/loaders/GLTFLoader.js')
      .then((mod) => new mod.GLTFLoader())
      .catch((err) => {
        console.warn('[DinoGrow] GLTFLoader unavailable, using procedural only:', err);
        return null;
      });
  }
  return loaderPromise;
}

const modelCache = new Map();      // species -> THREE.Group (loaded GLB scene)
const modelMissing = new Set();    // species we've already 404'd on (don't retry)
const pendingLoads = new Map();    // species -> Promise

const MODELS_BASE = './models/';
const TARGET_LENGTH = 2.0; // normalize all dinos to ~2 units long at scale 1.0

/**
 * Try to preload models from /models/. Always resolves; never throws.
 * If a probe HEAD request 404s, we skip ever trying to load.
 */
export async function preloadAllModels() {
  // Cheap probe: HEAD-check one expected file. If it's a 404, skip loading
  // entirely — the user hasn't dropped any Quaternius models in.
  let anyExist = false;
  try {
    const probe = await fetch(MODELS_BASE + SPECIES.trex.modelFile, { method: 'HEAD' });
    anyExist = probe.ok;
  } catch (_) {
    anyExist = false;
  }
  if (!anyExist) return [];

  const promises = [];
  for (const key of Object.keys(SPECIES)) {
    promises.push(tryLoadModel(key));
  }
  return Promise.allSettled(promises);
}

// Lazy-load SkeletonUtils for proper skinned-mesh cloning when GLBs have rigs.
let skUtilsPromise = null;
function getSkeletonUtils() {
  if (!skUtilsPromise) {
    skUtilsPromise = import('three/addons/utils/SkeletonUtils.js')
      .then((mod) => mod)
      .catch(() => null);
  }
  return skUtilsPromise;
}

async function tryLoadModel(speciesKey) {
  if (modelCache.has(speciesKey)) return modelCache.get(speciesKey);
  if (modelMissing.has(speciesKey)) return null;
  if (pendingLoads.has(speciesKey)) return pendingLoads.get(speciesKey);

  const spec = SPECIES[speciesKey];
  if (!spec || !spec.modelFile) {
    modelMissing.add(speciesKey);
    return null;
  }

  const url = MODELS_BASE + spec.modelFile;
  const p = (async () => {
    const loader = await getLoader();
    if (!loader) {
      modelMissing.add(speciesKey);
      return null;
    }
    return new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          normalizeModel(root, spec);
          // Keep animations attached to the cached root so each clone can
          // build its own AnimationMixer + Actions.
          root.userData.animations = gltf.animations || [];
          modelCache.set(speciesKey, root);
          resolve(root);
        },
        undefined,
        () => {
          modelMissing.add(speciesKey);
          resolve(null);
        }
      );
    });
  })();
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

  if (modelCache.has(speciesKey)) {
    const cached = modelCache.get(speciesKey);
    const inst = cached.clone(true);
    inst.userData.fromGLB = true;
    inst.userData.parts = {};
    inst.userData.animations = cached.userData.animations || [];
    inst.userData.pendingMixer = inst.userData.animations.length > 0;
    return inst;
  }

  const proc = spec.build(spec.color);
  proc.userData.fromGLB = false;
  return proc;
}

/**
 * Build an AnimationMixer + named actions for a GLB instance. Returns null
 * for procedural meshes or if SkeletonUtils isn't available. Picks the
 * best-matching clip names for idle/walk/run/attack heuristically.
 */
export async function attachMixer(instance, THREE) {
  if (!instance.userData.fromGLB) return null;
  const clips = instance.userData.animations;
  if (!clips || clips.length === 0) return null;

  // For skinned meshes, the default clone shares the skeleton — re-clone
  // via SkeletonUtils so animations don't move every other instance.
  const SK = await getSkeletonUtils();
  if (SK && SK.clone) {
    // Replace bones/skin properly. (Call sites add the instance to the
    // scene after this, so re-cloning is safe.)
    const re = SK.clone(instance);
    instance.clear();
    for (const child of [...re.children]) instance.add(child);
  }

  const mixer = new THREE.AnimationMixer(instance);
  const actions = {};
  for (const clip of clips) {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  }
  // Pick a reasonable default to play
  const pick = (...names) => names.map((n) => actions[n.toLowerCase()]).find(Boolean);
  const idle = pick('idle', 'idle_a', 'idle_1', 'stand', clips[0].name);
  if (idle) idle.play();

  instance.userData.mixer = mixer;
  instance.userData.actions = actions;
  instance.userData.currentAction = idle || null;
  instance.userData.pendingMixer = false;
  return mixer;
}

/**
 * Switch the model's playing animation based on a speed factor (0=idle, 1=run).
 * Crossfades between idle / walk / run if those clips exist. No-op for
 * procedural meshes (which keep their hand-coded leg-swing animation).
 */
export function setMotion(instance, speedNorm, fade = 0.2) {
  if (!instance || !instance.userData.actions) return;
  const acts = instance.userData.actions;
  const pick = (...names) => names.map((n) => acts[n.toLowerCase()]).find(Boolean);
  let target;
  if (speedNorm > 0.7)      target = pick('run', 'gallop', 'walk', 'walking', 'idle', 'idle_a');
  else if (speedNorm > 0.1) target = pick('walk', 'walking', 'run', 'idle', 'idle_a');
  else                      target = pick('idle', 'idle_a', 'idle_b', 'stand');
  if (!target) return;
  if (instance.userData.currentAction === target) return;
  if (instance.userData.currentAction) instance.userData.currentAction.fadeOut(fade);
  target.reset().fadeIn(fade).play();
  instance.userData.currentAction = target;
}

export function modelStatus() {
  return {
    loaded: [...modelCache.keys()],
    missing: [...modelMissing],
    total: Object.keys(SPECIES).length,
  };
}
