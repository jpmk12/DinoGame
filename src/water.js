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
        // Layered ripples — smaller amplitude so the surface reads as
        // gentle water rather than choppy waves.
        float w =
          sin(p.x * 0.45 + uTime * 1.1) * 0.05 +
          cos(p.z * 0.55 + uTime * 1.4) * 0.04 +
          sin((p.x + p.z) * 0.30 + uTime * 0.7) * 0.03;
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

      // Soft procedural noise — cheap pseudo-Voronoi via two sin/cos layers
      float caustic(vec2 p, float t) {
        float a = sin(p.x * 6.0 + t * 1.3) * cos(p.y * 5.0 - t * 1.1);
        float b = sin((p.x + p.y) * 4.5 + t * 0.7);
        return (a * 0.5 + b * 0.5) * 0.5 + 0.5;
      }

      void main() {
        // Base color blends from deep to shallow on wave crests so the
        // surface has subtle depth variation, not blown highlights.
        float depthMix = smoothstep(-0.05, 0.08, vWave);
        vec3 base = mix(uDeep, uShallow, depthMix * 0.7);

        // Soft caustic layer — gentle multi-layer noise that reads as
        // light playing on the water, not a hard chrome stripe.
        float c1 = caustic(vLocalPos.xz * 0.18, uTime * 0.6);
        float c2 = caustic(vLocalPos.xz * 0.32 + vec2(7.3, 1.1), -uTime * 0.4);
        float caust = c1 * 0.6 + c2 * 0.4;
        // Narrow the band so highlights are spots, not stripes
        caust = smoothstep(0.55, 0.92, caust);
        base += vec3(caust * 0.22, caust * 0.26, caust * 0.30);

        // Tiny sparkle — high-freq, low-amplitude, only catches occasionally
        float sp = sin(vLocalPos.x * 9.0 + uTime * 4.0)
                 * cos(vLocalPos.z * 11.0 - uTime * 3.0);
        sp = max(0.0, sp - 0.85) * 0.6;
        base += vec3(sp * 0.6);

        // Soft fresnel-like edge darkening — read more like water depth
        float radial = length(vUv - 0.5) * 2.0;
        float edge = smoothstep(0.85, 1.05, radial);
        base = mix(base, uDeep * 0.6, edge * 0.5);

        gl_FragColor = vec4(base, 0.86);
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
