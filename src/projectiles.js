import * as THREE from 'three';

// Pooled projectile system shared by helicopters, tanks, missile silos.
// Fixed-size pool — no allocations per shot, no GC pressure.
//
// Each projectile is a small glowing sphere + a thin trail line. They
// arc ballistically and check collision against the player every frame.
// When they hit, an onHit callback fires (caller decides knockback,
// growth loss, particles, etc.). Misses despawn after `life` seconds
// or when they pass below ground level.

const POOL_SIZE = 32;
const DEFAULT_GRAVITY = 7.5; // gentle so missiles arc visibly without being instant
let GRAVITY = DEFAULT_GRAVITY;

export function setProjectileGravity(g) { GRAVITY = g; }
export function resetProjectileGravity() { GRAVITY = DEFAULT_GRAVITY; }

const PROJECTILE_COLORS = {
  missile:  { core: 0xff5a3a, glow: 0xffb088, trail: 0xff6a4a },
  shell:    { core: 0xffd24a, glow: 0xfff0a0, trail: 0xffe680 },
};

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this._tmp = new THREE.Vector3();
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff5a3a,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);

      // Soft glow sphere wrapping the core
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff9a6a,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), glowMat);
      mesh.add(glow);

      this.pool.push({
        mesh,
        glowMat,
        coreMat: mat,
        alive: false,
        vel: new THREE.Vector3(),
        life: 0,
        kind: 'missile',
      });
    }
  }

  /**
   * Fire a projectile. `vel` is initial velocity (units / sec).
   */
  fire(origin, vel, kind = 'missile', life = 3.0) {
    const colors = PROJECTILE_COLORS[kind] || PROJECTILE_COLORS.missile;
    for (const p of this.pool) {
      if (p.alive) continue;
      p.alive = true;
      p.life = life;
      p.kind = kind;
      p.mesh.position.copy(origin);
      p.vel.copy(vel);
      p.mesh.visible = true;
      p.coreMat.color.setHex(colors.core);
      p.glowMat.color.setHex(colors.glow);
      return p;
    }
    return null; // pool full — quietly drop
  }

  /**
   * Tick every live projectile. Calls onHit(projectile) if it touches
   * the player. Despawns on ground hit, life timeout, or successful hit.
   */
  update(dt, playerPos, playerRadius, onHit) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      // Ballistic arc
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Collision with player (XZ distance for a forgiving hitbox)
      const dx = p.mesh.position.x - playerPos.x;
      const dy = p.mesh.position.y - playerPos.y - playerRadius;
      const dz = p.mesh.position.z - playerPos.z;
      const horiz2 = dx * dx + dz * dz;
      const hitR = playerRadius + 0.5;
      if (horiz2 < hitR * hitR && Math.abs(dy) < playerRadius * 1.5) {
        onHit && onHit(p);
        this._kill(p);
        continue;
      }

      if (p.life <= 0 || p.mesh.position.y < 0.2) {
        this._kill(p);
      }
    }
  }

  _kill(p) {
    p.alive = false;
    p.mesh.visible = false;
  }

  /**
   * Drop all live projectiles (level change, respawn). Doesn't free the
   * pool — the meshes stay attached to the scene for reuse.
   */
  clearAll() {
    for (const p of this.pool) this._kill(p);
  }
}
