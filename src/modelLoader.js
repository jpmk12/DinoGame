import * as THREE from 'three';
import { SPECIES } from './dinos.js';

// Loads Quaternius (or any) dinosaur models from /models/, with a graceful
// fallback to the procedural builder if the file is missing. Supports both
// GLB/glTF and FBX out of the box — whichever the user has dropped in
// /models/ for the trex slot is the format we use for the rest of the run.

let glbLoaderPromise = null;
function getGlbLoader() {
  if (!glbLoaderPromise) {
    glbLoaderPromise = import('three/addons/loaders/GLTFLoader.js')
      .then((mod) => new mod.GLTFLoader())
      .catch((err) => {
        console.warn('[DinoGrow] GLTFLoader unavailable:', err);
        return null;
      });
  }
  return glbLoaderPromise;
}

let fbxLoaderPromise = null;
function getFbxLoader() {
  if (!fbxLoaderPromise) {
    fbxLoaderPromise = import('three/addons/loaders/FBXLoader.js')
      .then((mod) => new mod.FBXLoader())
      .catch((err) => {
        console.warn('[DinoGrow] FBXLoader unavailable:', err);
        return null;
      });
  }
  return fbxLoaderPromise;
}

const modelCache = new Map();
const modelMissing = new Set();
const pendingLoads = new Map();

const MODELS_BASE = './models/';
// Normalize every loaded model so its longest horizontal axis is this many
// world units. Chosen to roughly match the procedural T-Rex's footprint
// so FBX/GLB dinos render at the same size as the procedural ones once
// the player's stage scale (0.35 -> 1.9) is applied.
const TARGET_LENGTH = 4.0;

// Which extension to use for this run. Detected at preload by HEAD-probing
// the trex file in both formats. 'glb' wins ties since it's lighter.
let modelExt = null;

function expectedFile(speciesKey, ext = modelExt) {
  const spec = SPECIES[speciesKey];
  if (!spec || !spec.modelFile) return null;
  // SPECIES.modelFile is stored with the .glb extension; swap to detected.
  const base = spec.modelFile.replace(/\.(glb|fbx)$/i, '');
  return base + '.' + (ext || 'glb');
}

/**
 * Try to preload models from /models/. Always resolves; never throws.
 * Detects whether the user has uploaded GLB or FBX files by HEAD-probing
 * both formats for the T-Rex entry; if neither exists we skip loading
 * entirely so there's no console noise.
 */
export async function preloadAllModels() {
  // If the trex species has no modelFile, the whole loader is opted out
  // (every species is procedural). Bail before any HEAD probes.
  if (!SPECIES.trex || !SPECIES.trex.modelFile) return [];

  // Probe both formats for the trex (the only species that must exist for
  // detection). Whichever responds with 200 wins.
  const trexBase = SPECIES.trex.modelFile.replace(/\.(glb|fbx)$/i, '');
  const candidates = ['glb', 'fbx'];
  for (const ext of candidates) {
    try {
      const probe = await fetch(MODELS_BASE + trexBase + '.' + ext, { method: 'HEAD' });
      if (probe.ok) { modelExt = ext; break; }
    } catch (_) { /* try next */ }
  }
  if (!modelExt) return [];

  // CRITICAL: load SkeletonUtils before any model can be cloned, so the
  // cached entries are cloned via SK.clone (with proper bone re-linking)
  // instead of the standard clone (which shares skeletons and silently
  // breaks SkinnedMesh rendering for every instance after the first).
  await getSkeletonUtils();

  const promises = [];
  for (const key of Object.keys(SPECIES)) {
    promises.push(tryLoadModel(key));
  }
  return Promise.allSettled(promises);
}

let skUtilsPromise = null;
let SK_MODULE = null;
function getSkeletonUtils() {
  if (!skUtilsPromise) {
    skUtilsPromise = import('three/addons/utils/SkeletonUtils.js')
      .then((mod) => { SK_MODULE = mod; return mod; })
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

  const url = MODELS_BASE + expectedFile(speciesKey);
  const isFbx = modelExt === 'fbx';

  const p = (async () => {
    const loader = isFbx ? await getFbxLoader() : await getGlbLoader();
    if (!loader) {
      modelMissing.add(speciesKey);
      return null;
    }
    return new Promise((resolve) => {
      loader.load(
        url,
        (loaded) => {
          const root = isFbx ? loaded : loaded.scene;
          const animations = isFbx ? (loaded.animations || []) : (loaded.animations || []);
          normalizeModel(root, spec);
          // Strip any per-bone .scale tracks. Quaternius walk/run anims
          // sometimes include cartoon squash-and-stretch on the leg bones
          // (the lower leg literally scales up during stride extension),
          // which Three.js plays back faithfully and reads as "stretching".
          // Removing the scale tracks keeps the natural position + rotation
          // motion intact. If a clip didn't have any scale tracks the call
          // is a no-op.
          const cleanedAnimations = stripScaleTracks(animations);
          root.userData.animations = cleanedAnimations;
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
// Build a copy of `clips` with any .scale tracks removed. Each AnimationClip
// is replaced by a new one when at least one of its tracks is filtered out;
// untouched clips pass through by reference.
function stripScaleTracks(clips) {
  const out = [];
  let strippedCount = 0;
  for (const clip of clips) {
    const filtered = clip.tracks.filter((t) => !t.name.endsWith('.scale'));
    if (filtered.length === clip.tracks.length) {
      out.push(clip);
    } else {
      strippedCount += clip.tracks.length - filtered.length;
      out.push(new THREE.AnimationClip(clip.name, clip.duration, filtered));
    }
  }
  if (strippedCount > 0) {
    console.log('[DinoGrow] Stripped', strippedCount, 'scale tracks (cartoon squash/stretch)');
  }
  return out;
}

function normalizeModel(root, spec) {
  // Apply shadow casting and tweak materials for the low-poly vibe.
  // Also disable frustum culling on SkinnedMesh — Three.js culls based on
  // bind-pose bounds, which often don't cover where the animated vertices
  // actually end up, so animated meshes can vanish even when on screen.
  // And renormalize skin weights — FBXLoader trims any vertex that had
  // more than 4 bone influences down to the 4 strongest, but doesn't
  // rescale the remaining weights so they still sum to 1. The result is
  // each affected vertex only PARTIALLY follows its bones during animation
  // and partially stays at bind pose — which looks like stretching, worst
  // on long bones that swing the most (the shins during a walk cycle).
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.isSkinnedMesh) {
        obj.frustumCulled = false;
        if (obj.normalizeSkinWeights) obj.normalizeSkinWeights();
      }
    }
  });

  // Force every loaded model to a known world size (TARGET_LENGTH along
  // the longest horizontal axis). The stage-scale system downstream
  // (0.35 hatchling -> 1.9 giant) assumes this base. Leaving a model at
  // its natural size means a 6-unit GLB renders 6x bigger than the
  // procedural dinos at the same stage - which is what was hiding the
  // T-Rex inside the camera.
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.z) || size.y || 1;
  let s = TARGET_LENGTH / longest;
  // Safety clamp against runaway scales from mis-measured bounding boxes.
  s = Math.max(0.001, Math.min(s, 100));
  console.log(
    '[DinoGrow] normalize',
    spec.name + ':',
    'longest=' + longest.toFixed(3),
    'scale=' + s.toFixed(3),
  );
  root.scale.multiplyScalar(s);

  // Re-measure after scaling
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  // Move so feet sit on y=0 and center on x/z
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box2.min.y;

  // CRITICAL for FBX skinning: the boneInverses captured by the original
  // bind() (at load time, pre-scale) no longer match the bones' current
  // world transforms after the scale we just applied. Without recomputing
  // them here, the skeleton tells the shader "this bone moved from its
  // bind pose by (scale factor)" every frame and vertices skin toward the
  // wrong target — most visibly on the lower legs / shins. Re-bind so the
  // inverses match the post-normalize bones.
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (obj.isSkinnedMesh && obj.skeleton) {
      obj.skeleton.calculateInverses();
      obj.bind(obj.skeleton, obj.matrixWorld);
    }
  });
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
// One-shot debug print so we can see what's actually happening when a
// player FBX clone is built. Logs once per session.
let _debugPrintedOnce = false;
function debugDumpFirstClone(inst, speciesKey) {
  if (_debugPrintedOnce) return;
  _debugPrintedOnce = true;
  let meshCount = 0, skinnedCount = 0, boneCount = 0;
  let firstSkinned = null;
  inst.traverse((o) => {
    if (o.isMesh) meshCount++;
    if (o.isSkinnedMesh) { skinnedCount++; if (!firstSkinned) firstSkinned = o; }
    if (o.isBone) boneCount++;
  });
  const box = new THREE.Box3().setFromObject(inst);
  console.log('[DinoGrow] First model clone:', speciesKey, {
    meshCount, skinnedCount, boneCount,
    boundsMin: box.min.toArray().map((n) => +n.toFixed(2)),
    boundsMax: box.max.toArray().map((n) => +n.toFixed(2)),
    instScale: inst.scale.toArray().map((n) => +n.toFixed(2)),
    firstSkinnedVisible: firstSkinned && firstSkinned.visible,
    firstSkinnedFrustumCulled: firstSkinned && firstSkinned.frustumCulled,
  });
}

export function createDinoMeshSync(speciesKey) {
  const spec = SPECIES[speciesKey];
  if (!spec) throw new Error(`Unknown species: ${speciesKey}`);

  if (modelCache.has(speciesKey)) {
    const cached = modelCache.get(speciesKey);
    // SK.clone on the bare cached root (no extra wrapper around it) so
    // SkeletonUtils sees exactly the hierarchy from the loader.
    const bare = (SK_MODULE && SK_MODULE.clone)
      ? SK_MODULE.clone(cached)
      : cached.clone(true);
    // NB: previously rotated `bare` 180deg here to flip Quaternius's
    // +Z-forward convention to the game's -Z-forward. That broke skinning
    // (the bind matrices were captured by SK.clone *without* the rotation,
    // so at runtime the bones ended up in different world positions than
    // their bind pose - vertices skinned to wrong targets, causing
    // visible stretching during walk cycles).
    // Instead, callers add Math.PI to the wrapper's rotation when this
    // wrapper holds an FBX/GLB clone. Marker below.
    const inst = new THREE.Group();
    inst.add(bare);
    inst.userData.faceFlip = Math.PI;
    inst.traverse((o) => {
      if (o.isSkinnedMesh) o.frustumCulled = false;
      if (o.isMesh && o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          // Force visibility — some FBX exports come in with stray
          // transparency / low opacity that hides the mesh.
          if (m.transparent && m.opacity < 0.5) m.opacity = 1;
          m.visible = true;
        }
      }
    });
    inst.userData.fromGLB = true;
    inst.userData.parts = {};
    inst.userData.animations = cached.userData.animations || [];
    inst.userData.pendingMixer = inst.userData.animations.length > 0;
    debugDumpFirstClone(inst, speciesKey);
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
// Find the first action whose clip name CONTAINS any of the needles.
// We use contains-match (not exact) so Quaternius-style names like
// "Triceratops_Idle" or "Anim_Idle_1" still match an "idle" search.
function findClip(actions, ...needles) {
  for (const needle of needles) {
    for (const key of Object.keys(actions)) {
      if (key.includes(needle)) return actions[key];
    }
  }
  return null;
}

let _animsLogged = new Set();
export function attachMixer(instance, THREE) {
  if (!instance.userData.fromGLB) return null;
  const clips = instance.userData.animations;
  if (!clips || clips.length === 0) return null;

  const mixer = new THREE.AnimationMixer(instance);
  const actions = {};
  for (const clip of clips) {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  }
  // One-shot log per species so the user can see exactly which clip names
  // their pack ships with. Useful for tuning the idle/walk/run matchers.
  const speciesTag = instance.userData.species || 'model';
  if (!_animsLogged.has(speciesTag)) {
    _animsLogged.add(speciesTag);
    console.log('[DinoGrow] Animations for', speciesTag, ':', Object.keys(actions));
    // Diagnose IK-not-baked: dump how many bones each clip actually animates.
    // If "walk" / "run" hit far fewer bones than "idle" or the full skeleton
    // size (>~30 for a quadruped), the lower leg + foot bones are probably
    // IK targets that need solving at runtime — Three.js doesn't do that,
    // so those bones sit at bind pose while their parents rotate, which
    // looks like stretching between hip and ankle.
    let skeletonBones = 0;
    instance.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) {
        skeletonBones = Math.max(skeletonBones, o.skeleton.bones.length);
      }
    });
    for (const clip of clips) {
      const animated = new Set();
      for (const track of clip.tracks) animated.add(track.name.split('.')[0]);
      console.log(`  ↳ ${clip.name}: animates ${animated.size} of ${skeletonBones} bones`);
    }
  }
  // Prefer a real "Idle" clip; fall back to the first clip only as a last
  // resort. Falling back to clips[0] when it's actually a death/attack
  // pose was what made the dino look like it had collapsed at spawn.
  const idle = findClip(actions, 'idle', 'stand', 'rest')
    || mixer.clipAction(clips[0]);
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
  let target;
  if (speedNorm > 0.7)      target = findClip(acts, 'run', 'gallop', 'walking', 'walk', 'idle');
  else if (speedNorm > 0.1) target = findClip(acts, 'walk', 'walking', 'run', 'idle');
  else                      target = findClip(acts, 'idle', 'stand', 'rest');
  if (!target) return;
  if (instance.userData.currentAction === target) return;
  if (instance.userData.currentAction) instance.userData.currentAction.fadeOut(fade);
  target.reset().fadeIn(fade).play();
  instance.userData.currentAction = target;
}

export function modelStatus() {
  // Only species that declare a modelFile can ever load; exclude
  // procedural-only entries (like Titan) from the total so the badge
  // reflects what's actually possible to load.
  const loadable = Object.values(SPECIES).filter((s) => s.modelFile).length;
  return {
    loaded: [...modelCache.keys()],
    missing: [...modelMissing],
    total: loadable,
    format: modelExt,
  };
}
