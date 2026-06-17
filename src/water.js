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
    uniforms: {
      uTime:    { value: 0 },
      uDeep:    { value: new THREE.Color(0x1a3a7a) },
      uShallow: { value: new THREE.Color(0x6abee8) },
      uFoam:    { value: new THREE.Color(0xeaf6ff) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2  vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        // Stack a few sine ripples for a busy surface
        float w =
          sin(p.x * 0.6 + uTime * 1.4) * 0.08 +
          cos(p.z * 0.7 + uTime * 1.7) * 0.06 +
          sin((p.x + p.z) * 0.4 + uTime * 0.9) * 0.05;
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
      void main() {
        float depthMix = smoothstep(-0.08, 0.10, vWave);
        vec3  base    = mix(uDeep, uShallow, depthMix);
        // Animated shimmer band that drifts across the surface
        float shimmer = sin((vUv.x + vUv.y) * 24.0 + uTime * 2.0) * 0.5 + 0.5;
        shimmer = pow(shimmer, 8.0);
        base = mix(base, uFoam, shimmer * 0.4);
        gl_FragColor = vec4(base, 0.88);
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
  const geom = new THREE.CircleGeometry(radius, 28);
  geom.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geom, getWaterMaterial());
  m.receiveShadow = true;
  return m;
}

/**
 * Rectangular body of water — used for swamp pools and city rivers.
 */
export function buildWaterRect(w, d, segsW = 12, segsD = 12) {
  const geom = new THREE.PlaneGeometry(w, d, segsW, segsD);
  geom.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geom, getWaterMaterial());
  m.receiveShadow = true;
  return m;
}
