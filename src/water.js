import * as THREE from 'three';

// Simple stylized water: gentle vertex ripples + animated specular shimmer
// via a shader. Cheap on mobile (just a plane with a custom material) and
// reads as moving water without needing reflection probes.

const _shared = {
  material: null,
  time: 0,
};

function makeWaterMaterial() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime:    { value: 0 },
      uDeep:    { value: new THREE.Color(0x143a66) },
      uShallow: { value: new THREE.Color(0x4aa8d8) },
      uFoam:    { value: new THREE.Color(0xdaeefc) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2  vUv;
      varying float vWave;
      varying vec3  vLocalPos;
      void main() {
        vUv = uv;
        vLocalPos = position;
        vec3 p = position;
        // Big rolling swells + medium chop + small high-freq detail so the
        // surface visibly moves at every scale. Amplitude is large enough
        // to read as "alive" from the gameplay camera height.
        float w =
          sin(p.x * 0.22 + uTime * 0.9) * 0.32 +              // long swells
          cos(p.z * 0.28 + uTime * 1.2) * 0.26 +              // cross swell
          sin((p.x + p.z) * 0.45 + uTime * 1.6) * 0.14 +      // medium chop
          cos((p.x * 0.7 - p.z * 0.5) + uTime * 2.4) * 0.08 + // wind chop
          sin(p.x * 1.6 + p.z * 1.3 + uTime * 3.2) * 0.04;    // ripples
        p.y += w;
        vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep, uShallow, uFoam;
      uniform float uTime;
      varying vec2  vUv;
      varying float vWave;
      varying vec3  vLocalPos;

      // Cheap pseudo-noise for caustics
      float caustic(vec2 p, float t) {
        float a = sin(p.x * 6.0 + t * 1.3) * cos(p.y * 5.0 - t * 1.1);
        float b = sin((p.x + p.y) * 4.5 + t * 0.7);
        return (a * 0.5 + b * 0.5) * 0.5 + 0.5;
      }

      void main() {
        // Crest-color reveal — bright shallow tint on wave tops, deep blue
        // in troughs. This is what makes the surface read as 3D water.
        float depthMix = smoothstep(-0.20, 0.30, vWave);
        vec3 base = mix(uDeep, uShallow, depthMix);

        // Animated caustic mottle — two layers drifting in opposite
        // directions at different scales gives constant visible motion.
        float c1 = caustic(vLocalPos.xz * 0.20, uTime * 1.4);
        float c2 = caustic(vLocalPos.xz * 0.36 + vec2(7.3, 1.1), -uTime * 1.0);
        float caust = c1 * 0.6 + c2 * 0.4;
        caust = smoothstep(0.50, 0.90, caust);
        base += vec3(caust * 0.25, caust * 0.30, caust * 0.34);

        // Foam crests — only on the highest waves
        float foam = smoothstep(0.20, 0.32, vWave);
        base = mix(base, uFoam, foam * 0.55);

        // Drifting "wind line" — a soft bright stripe that crosses the
        // surface every few seconds, reads as wind catching the light.
        float wind = sin((vLocalPos.x * 0.10 + vLocalPos.z * 0.06) - uTime * 0.8);
        wind = smoothstep(0.85, 1.0, wind);
        base += vec3(wind * 0.25);

        // High-freq sparkle on crests
        float sp = sin(vLocalPos.x * 11.0 + uTime * 5.0)
                 * cos(vLocalPos.z * 13.0 - uTime * 4.0);
        sp = max(0.0, sp - 0.75) * 0.7;
        base += vec3(sp);

        gl_FragColor = vec4(base, 0.92);
      }
    `,
  });
  return mat;
}

export function getWaterMaterial() {
  if (!_shared.material) _shared.material = makeWaterMaterial();
  return _shared.material;
}

export function updateWater(dt) {
  if (!_shared.material) return;
  _shared.time += dt;
  _shared.material.uniforms.uTime.value = _shared.time;
}

/**
 * Disc of water (used for park ponds).
 */
export function buildPondMesh(radius = 4) {
  // Higher segment count: the polygon corners were reading as broken
  // crystal shards. 64 is round enough to look organic at any distance.
  const geom = new THREE.CircleGeometry(radius, 64);
  geom.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geom, getWaterMaterial());
  m.receiveShadow = true;
  return m;
}

/**
 * Rectangular body of water — used for swamp pools and city rivers.
 */
export function buildWaterRect(w, d, segsW = 24, segsD = 24) {
  const geom = new THREE.PlaneGeometry(w, d, segsW, segsD);
  geom.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geom, getWaterMaterial());
  m.receiveShadow = true;
  return m;
}
