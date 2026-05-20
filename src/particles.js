import * as THREE from 'three';

// Lightweight box-particle system. Particles are individual small meshes,
// not a Points cloud — gives them solid shading consistent with the dinos.

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this._geomBox = new THREE.BoxGeometry(1, 1, 1);
  }

  /**
   * Spawn a burst of particles at `position`.
   * options.count, color, size, speed, life, gravity, upBias
   */
  burst(position, options = {}) {
    const {
      count = 10,
      color = 0x88ee88,
      size = 0.15,
      speed = 4,
      life = 0.8,
      gravity = -10,
      upBias = 0.6,
      colors = null, // array; if provided, each particle picks one randomly
    } = options;

    for (let i = 0; i < count; i++) {
      const c = colors
        ? colors[Math.floor(Math.random() * colors.length)]
        : color;
      const mat = new THREE.MeshLambertMaterial({
        color: c,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(this._geomBox, mat);
      const s = size * (0.7 + Math.random() * 0.7);
      mesh.scale.setScalar(s);
      mesh.position.copy(position);
      mesh.position.y += 0.3;
      mesh.castShadow = false;

      const angle = Math.random() * Math.PI * 2;
      const horiz = (0.3 + Math.random() * 0.7) * speed;
      const vy = (upBias + Math.random() * (1 - upBias)) * speed;
      const vel = new THREE.Vector3(
        Math.cos(angle) * horiz,
        vy,
        Math.sin(angle) * horiz
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel,
        life,
        maxLife: life,
        gravity,
        rot: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;
      // Bounce off ground once
      if (p.mesh.position.y < 0.05 && p.vel.y < 0) {
        p.mesh.position.y = 0.05;
        p.vel.y *= -0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      p.mesh.rotation.x += p.rot.x * dt;
      p.mesh.rotation.y += p.rot.y * dt;
      p.mesh.rotation.z += p.rot.z * dt;
      p.mat.opacity = Math.min(1, p.life / p.maxLife);
    }
  }

  // ---------- Preset effects ----------

  leaves(position) {
    this.burst(position, {
      count: 8, colors: [0x4ab050, 0x6ac066, 0x88dd66],
      size: 0.18, speed: 3.5, life: 0.8, gravity: -8,
    });
  }

  meat(position) {
    this.burst(position, {
      count: 12, colors: [0xc44a4a, 0xa03030, 0xee7a7a],
      size: 0.16, speed: 4.5, life: 0.7, gravity: -12,
    });
  }

  sparkles(position) {
    this.burst(position, {
      count: 18, colors: [0xffe44a, 0xfff8cc, 0xffffff, 0xffaa55],
      size: 0.12, speed: 5, life: 1.2, gravity: -3, upBias: 0.8,
    });
  }

  dust(position) {
    this.burst(position, {
      count: 6, colors: [0xd4c098, 0xb8a880],
      size: 0.22, speed: 2, life: 0.6, gravity: -5, upBias: 0.2,
    });
  }

  confetti(position) {
    this.burst(position, {
      count: 80,
      colors: [
        0xff5555, 0xffe44a, 0x4aee88, 0x4a99ff, 0xee4aee,
        0xffaa44, 0x4adddd, 0xff44aa,
      ],
      size: 0.22, speed: 8, life: 2.5, gravity: -6, upBias: 0.9,
    });
  }

  watermelon(position) {
    // Pink/red flesh + green rind chunks
    this.burst(position, {
      count: 14, colors: [0xff6a8a, 0xee5577, 0xff99aa],
      size: 0.22, speed: 5, life: 1.0, gravity: -10,
    });
    this.burst(position, {
      count: 6, colors: [0x2a6a2a, 0x6aa050],
      size: 0.18, speed: 3.5, life: 0.9, gravity: -10,
    });
    // Black "seeds"
    this.burst(position, {
      count: 8, color: 0x222020,
      size: 0.06, speed: 6, life: 1.4, gravity: -12,
    });
  }
}
