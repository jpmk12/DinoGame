// Kid-friendly dinosaur facts. Shown the first time the player eats each
// species in a session (via a toast at the bottom of the screen).

export const DINO_FACTS = {
  trex: "T-Rex had teeth as long as bananas!",
  toro: "Allosaurus had ridges over its eyes like little horns — and a savage bite!",
  trike: "Triceratops had three sharp horns and a giant bony frill!",
  stego: "Stegosaurus's brain was only the size of a walnut!",
  raptor: "Real Velociraptors were the size of a turkey and had feathers!",
  brachio: "Brachiosaurus could reach leaves 50 feet up — like a 5-story building!",
  spino: "Spinosaurus could swim and was even bigger than a T-Rex!",
  anky: "Ankylosaurus had a tail club that could crack bones!",
  para: "Parasaurolophus made trumpet sounds with its head crest!",
  ptero: "Pteranodon could glide as far as a football field without flapping!",
};

const _seenSpecies = new Set();
const _seenCritter = { v: false };

export function resetFacts() {
  _seenSpecies.clear();
  _seenCritter.v = false;
}

/**
 * Returns a fact string the first time we see this species in the session,
 * else null.
 */
export function factForSpecies(speciesKey) {
  if (_seenSpecies.has(speciesKey)) return null;
  _seenSpecies.add(speciesKey);
  return DINO_FACTS[speciesKey] || null;
}

export function factForCritter() {
  if (_seenCritter.v) return null;
  _seenCritter.v = true;
  return "Tiny critters scurry through the underbrush — perfect snacks!";
}
