# Titan Expansion Roadmap

Titan is the favorite — lean all the way into the kaiju city-stomper
fantasy. Every piece of new content earns its place in a Godzilla movie.

## Guiding principles

- **Atomic Charge is the new core loop.** Stomp → fill meter → unleash.
  Every new feature should either fill the meter, spend the meter, or
  give the meter somewhere new to matter.
- **One control change, max.** Plasma Breath stays on the action button.
  New moves layer on with hold / double-tap / chord, not a new button.
- **Reuse existing systems.** AOE pattern (Sweep/Stomp), beam mesh,
  building topple, particles, audio — every new ability should compose
  these primitives, not invent its own pipeline.
- **Procedural-first.** Every new enemy ships with a procedural mesh
  fallback so a missing model never breaks the game.
- **Kid-friendly difficulty.** Bosses stay off until the curve is dialed.
  Air enemies don't one-shot you. The fantasy is power, not stress.

---

## Phase A — Atomic Charge Meter (the core economy)

The single highest-leverage addition. Everything later balances against
this loop.

- **A1. Charge state + earn rate.** Track `player.userData.atomicCharge`
  (0-100). Buildings = +8, enemies = +5 × stage, critters = +1,
  vehicles = +6. Persist to next level so a Titan run accumulates power.
- **A2. HUD meter.** Glowing horizontal bar above the HUD, pulsing when
  full. Reuse the powerup-indicator CSS pattern.
- **A3. Mega Beam.** When the meter is full, **HOLD** the action button
  for 0.8s to unleash a 60u-range megabeam — same beam mesh but thicker,
  brighter bloom, 3× radius, drains the whole meter, screen-clears
  enemies and topples every building in the cone.
- **A4. Charge VFX.** Plate emissive intensity scales with current
  charge so you can see Titan power up visually. Faint hum audio when
  the meter is past 50%.

**Scope:** Titan-only for now (other species ignore atomicCharge field).

---

## Phase B — Combat variety (5 new Titan moves)

All chord onto the existing action button — no new HUD buttons.

- **B1. Plasma Pulse.** Double-tap action → 360° plasma burst, 16u
  radius. Costs 25 charge (gates spam). Existing radial-AOE code from
  Sweep/Stomp.
- **B2. Stomp Quake.** Chord (CHOMP + Action) → leap up, slam down,
  ring shockwave knocks down everything in 20u + screen shake. Free,
  10s cooldown.
- **B3. Tail Sweep.** Chord (move backward while pressing Action) →
  rear-arc tail swipe, levels a row of buildings behind Titan. Reuses
  Sweep AOE filtered to a rear cone.
- **B4. Plate Launch.** Auto-fires at airborne targets in front when
  Action is pressed and the cone hits an aerial enemy. 3 plasma plates
  in a quick burst (new lightweight projectile entity).
- **B5. Beam Sweep.** Hold the action button while turning → beam tracks
  the player's rotation. Just have to keep the beam mesh alive while
  `controls.blastPressed` is held instead of one-shot.

**Each B-task is independently shippable.** Pick any order.

---

## Phase C — Air enemies (unblocks Plate Launch + new level flavor)

Adds a whole vertical-combat axis the game has never had.

- **C1. Helicopter entity.** Hovers in lazy circles 8u above ground,
  fires slow telegraphed missiles (2s arming with red laser sight).
  Procedural mesh: cylinder body + rotor disc + tail boom.
- **C2. Fighter Jet entity.** Strafes across the map in straight lines
  at altitude, only vulnerable while banking at the ends. Two delta
  triangles + a cone fuselage.
- **C3. Drone swarm.** Tiny floaters in groups of 5, easy to swat,
  satisfying particle confetti on death.
- **C4. Missile/projectile system.** Generic projectile pool — used by
  helicopters, tanks, future enemies. Limited count, pooled, simple
  ballistic arc.

---

## Phase D — Ground military enemies

Threats that hit hard but stay grounded.

- **D1. Tank entity.** Slow, treaded, fires shells at the player every
  ~3s. Procedural: box hull + turret + barrel cylinder. Treads animated
  as a scrolling texture.
- **D2. Missile silo.** Static high-score target (50 pts), occasionally
  fires a missile straight up that arcs back down toward the player.
- **D3. Soldier squad.** Tiny humanoids that flee on sight — pure prey,
  not threat. Eating them feels powerful.

---

## Phase E — Rival kaiju

The "mirror match" content. Big silhouette variety.

- **E1. Mecha Titan.** Chrome + red recolor of Titan with a shield
  phase (every 8s reflects projectiles for 2s). Beats the "everything's
  a dinosaur" problem.
- **E2. Giant Crab.** Wide silhouette, side-shuffle locomotion, eats
  buildings sideways. Procedural: two big claws + dome body + 8 legs.
- **E3. Giant Moth.** Flying, drops larva eggs that hatch into critters.
  Procedural: cone body + 2 wing planes flapping.
- **E4. Giant Scorpion.** Desert/lava biome match. Stinger tail does an
  arc telegraph. Procedural: segmented box body + claw arms + tail.

---

## Phase F — New levels

Each level should highlight a different subset of B/C/D/E content.

- **F1. Harbor Assault.** Sea biome — Titan walks out of the water,
  battleships, cranes, oil rigs (explode for huge charge fill), distant
  helicopters. Uses C1 + the water shader already exists.
- **F2. Military Base.** Tanks (D1), silos (D2), soldiers (D3), radar
  dishes as static stomp targets, helicopters (C1), jets (C2). The
  level where everything shoots back.
- **F3. Skyscraper Megacity.** Taller, denser City Rampage. Landmark
  buildings (Tokyo-Tower-ish, Empire-State-ish) worth 10× score. Drones
  (C3) swarm between buildings.
- **F4. Power Plant.** Reactor cores scattered around — eating one
  instantly fills the Atomic Charge meter. Cooling towers as massive
  topple targets. Mecha Titan (E1) as the level's antagonist enemy.
- **F5. Mountain Pass / Highway.** Long linear strip rather than open
  arena. Convoys of big-rig trucks, bridges to topple, distant
  mountain skyline. Tanks (D1), jets (C2) overhead.
- **F6. Lava Throne.** Titan's home. Molten ground, volcanic eruptions
  as random hazards, Giant Scorpion (E4) ambient enemies. Becomes a
  rival-Titan boss arena once bosses are re-enabled.

---

## Sequencing recommendation

Roughly:

```
A  ──▶  B  ──▶  C  ──▶  F1, F3
            ╲
             ╲──▶  D  ──▶  F2, F5
             ╲
              ╲─▶  E  ──▶  F4, F6
```

1. **Phase A first.** Without the Charge meter, every new move feels
   like a sidegrade. With it, every other feature has somewhere to plug
   in.
2. **Then Phase B** — variety. Picks the most flavor per line of code.
3. **Then air enemies (C)** to give Plate Launch (B4) something to
   actually target, plus open up a whole new vertical axis.
4. **Levels in parallel** with whichever enemy phase they need —
   Harbor + Megacity unblock after C; Military + Highway need D;
   Power Plant + Lava Throne need E.

We work it one piece at a time. Tasks below capture Phase A first.
