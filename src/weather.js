import * as THREE from 'three';
import { getLevel } from './levels.js';
import { getHeightAt } from './world.js';

// Ambient weather: snow, embers, or fireflies. Particles stay clustered
// around the player so we only need a small pool to fill the screen.

const RADIUS = 35;     // particles drift within this distance of the player
const POOL_SIZE = 90;

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.kind = null;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  setKind(kind) {
    if (this.kind === kind) return;
    this.clear();
    this.kind = kind;
    if (!kind) return;

    // Choose visuals by kind
    const recipes = {
      snow:     { color: 0xffffff, emissive: 0.0, size: 0.18 },
      embers:   { color: 0xff7a3a, emissive: 0.9, size: 0.12 },
      fireflies:{ color: 0xfff099, emissive: 1.0, size: 0.10 },
    };
    const r = recipes[kind];
    const geom = new THREE.SphereGeometry(r.size, 6, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: r.color,
      transparent: true,
      opacity: kind === 'snow' ? 0.9 : 1.0,
    });
    if (r.emissive > 0) {
      mat.color.multiplyScalar(1 + r.emissive); // boost brightness so bloom catches them
    }
    for (let i = 0; i < POOL_SIZE; i++) {
      const m = new THREE.Mesh(geom, mat);
      m.castShadow = false;
      m.renderOrder = 1;
      this.group.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        respawn: true,
      });
    }
  }

  clear() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    }
    this.particles = [];
    this.kind = null;
  }

  _placeAroundPlayer(p, playerPos, fresh = false) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * RADIUS;
    p.mesh.position.x = playerPos.x + Math.cos(ang) * r;
    p.mesh.position.z = playerPos.z + Math.sin(ang) * r;

    if (this.kind === 'snow') {
      // Snow starts high and falls
      p.mesh.position.y = playerPos.y + 18 + Math.random() * 8;
      p.vel.set(
        (Math.random() - 0.5) * 0.4,
        -2 - Math.random() * 1.2,
        (Math.random() - 0.5) * 0.4
      );
    } else if (this.kind === 'embers') {
      // Embers rise from low
      const groundY = getHeightAt(p.mesh.position.x, p.mesh.position.z);
      p.mesh.position.y = groundY + Math.random() * 2;
      p.vel.set(
        (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 2,
        (Math.random() - 0.5) * 0.5
      );
    } else if (this.kind === 'fireflies') {
      // Fireflies float around at varied heights, slow random drift
      const groundY = getHeightAt(p.mesh.position.x, p.mesh.position.z);
      p.mesh.position.y = groundY + 0.6 + Math.random() * 3;
      p.vel.set(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.6
      );
      p.phase = Math.random() * Math.PI * 2;
    }
  }

  update(dt, playerPos) {
    if (!this.kind) return;
    for (const p of this.particles) {
      // First-time placement
      if (p.respawn) {
        this._placeAroundPlayer(p, playerPos, true);
        p.respawn = false;
      }

      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Per-kind extras
      if (this.kind === 'fireflies') {
        // Pulse opacity for blinky glow
        p.phase += dt * (2 + Math.random() * 1);
        const a = 0.4 + Math.abs(Math.sin(p.phase)) * 0.6;
        p.mesh.material.opacity = a;
        // Random gentle direction nudges
        if (Math.random() < 0.02) {
          p.vel.x = (Math.random() - 0.5) * 0.6;
          p.vel.z = (Math.random() - 0.5) * 0.6;
          p.vel.y = (Math.random() - 0.5) * 0.3;
        }
      } else if (this.kind === 'embers') {
        // Fade out toward the top of their travel
        p.phase += dt;
        p.mesh.material.opacity = Math.max(0, 1 - p.phase * 0.25);
      }

      // Respawn conditions
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      const offGrid = Math.hypot(dx, dz) > RADIUS;
      let recycle = false;
      if (this.kind === 'snow') {
        // Snow respawns when it hits ground
        const groundY = getHeightAt(p.mesh.position.x, p.mesh.position.z);
        if (p.mesh.position.y < groundY + 0.2) recycle = true;
        if (offGrid) recycle = true;
      } else if (this.kind === 'embers') {
        if (p.phase > 4) recycle = true;
        if (offGrid) recycle = true;
      } else if (this.kind === 'fireflies') {
        if (offGrid) recycle = true;
      }
      if (recycle) {
        this._placeAroundPlayer(p, playerPos);
        if (this.kind === 'embers') p.phase = 0;
      }
    }
  }
}

export function buildWeather(scene) {
  const w = new WeatherSystem(scene);
  const level = getLevel();
  w.setKind(level.weather);
  return w;
}
