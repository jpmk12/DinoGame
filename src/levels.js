// Level themes — each defines the visual palette and atmosphere of a world.
// World/lighting/fog/weather all read from the active theme.

export const LEVELS = {
  lostWorld: {
    key: 'lostWorld',
    name: 'Lost World',
    desc: 'Forest, swamp, desert',
    icon: '🌳',
    biomeColors: {
      forest: 0x5fae5c,
      swamp:  0x4a7a5a,
      desert: 0xd4b070,
    },
    sky: { top: 0x3b6fb0, mid: 0x9cd3ff, bottom: 0xffd8a8, glow: [0.18, 0.12, 0.04] },
    fog: { color: 0xeac49a, density: 0.011 },
    sun: { color: 0xfff1cf, intensity: 1.15, pos: [30, 60, 20] },
    hemi: { sky: 0xb0d4f0, ground: 0x4a5a30, intensity: 0.65 },
    rim: { color: 0xa8c8ff, intensity: 0.35 },
    cloud: { color: 0xffffff, emissive: 0.15 },
    weather: null,
    objective: { kind: 'reachStage', value: 4, text: 'Reach the GIANT stage' },
  },

  volcano: {
    key: 'volcano',
    name: 'Volcano Lands',
    desc: 'Lava and ash',
    icon: '🌋',
    biomeColors: {
      forest: 0x6a3a2a,
      swamp:  0x8a4a3a,
      desert: 0xaa6a4a,
    },
    sky: { top: 0x2a0a1a, mid: 0x6a2a1a, bottom: 0xff7a44, glow: [0.30, 0.15, 0.05] },
    fog: { color: 0x8a3a2a, density: 0.016 },
    sun: { color: 0xff9966, intensity: 1.05, pos: [30, 55, 20] },
    hemi: { sky: 0xaa4a3a, ground: 0x5a2a1a, intensity: 0.6 },
    rim: { color: 0xff6a3a, intensity: 0.55 },
    cloud: { color: 0x4a2a2a, emissive: 0.05 }, // dark ash clouds
    weather: 'embers',
    objective: { kind: 'eatDinos', value: 12, text: 'Devour 12 enemy dinos' },
  },

  tundra: {
    key: 'tundra',
    name: 'Frozen Tundra',
    desc: 'Snow and ice',
    icon: '❄️',
    biomeColors: {
      forest: 0xc0d4dc,
      swamp:  0xa6bdcc,
      desert: 0xe6eef4,
    },
    sky: { top: 0x4a6a8a, mid: 0x8eb2c8, bottom: 0xd2e2ec, glow: [0.10, 0.12, 0.16] },
    fog: { color: 0xc8ddee, density: 0.014 },
    sun: { color: 0xcedaef, intensity: 0.95, pos: [30, 60, 20] },
    hemi: { sky: 0xc0d4e8, ground: 0x9aa6b0, intensity: 0.75 },
    rim: { color: 0xa0c0e8, intensity: 0.4 },
    cloud: { color: 0xffffff, emissive: 0.2 },
    weather: 'snow',
    objective: { kind: 'eatCritters', value: 25, text: 'Catch 25 scurrying critters' },
  },

  dinoPark: {
    key: 'dinoPark',
    name: 'Dino Park',
    desc: 'Tropical jungle island',
    icon: '🏝️',
    biomeColors: {
      forest: 0x2a6a3a,   // deep jungle green
      swamp:  0x3a5a2a,   // mossy lowland
      desert: 0xe8d6a8,   // sandy beach
    },
    sky: { top: 0x4080b0, mid: 0x9ad0e8, bottom: 0xcce0d8, glow: [0.10, 0.14, 0.10] },
    fog: { color: 0xa8c4b8, density: 0.014 },
    sun: { color: 0xfff0c8, intensity: 1.0, pos: [25, 55, 25] },
    hemi: { sky: 0xa0c8b8, ground: 0x3a6a3a, intensity: 0.65 },
    rim: { color: 0xa0c0a0, intensity: 0.4 },
    cloud: { color: 0xe8e8ec, emissive: 0.1 },
    weather: 'rain',
    tropicalTrees: true,         // jungle trees use palms; ferns spawn as ground cover
    mountainColor: 0x5a5048,     // darker basalt for the volcanic peak
    vehicles: true,              // park ranger jeeps patrol this level
    centerPeak: {                // a visible iconic volcano peak
      x: -55, z: -55,
      radius: 38,
      height: 42,
    },
    objective: { kind: 'chompVehicles', value: 5, text: 'Chomp 5 ranger jeeps' },
  },

  cityRampage: {
    key: 'cityRampage',
    name: 'City Rampage',
    desc: 'Smash the city!',
    icon: '🏙️',
    biomeColors: {
      forest: 0x4a6a4a,   // park green
      swamp:  0x4a4f57,   // dark asphalt
      desert: 0x6a6f78,   // concrete grey
    },
    sky: { top: 0x3a4a6a, mid: 0x8a90a8, bottom: 0xe0a878, glow: [0.22, 0.13, 0.06] },
    fog: { color: 0xb6ac9c, density: 0.012 },
    sun: { color: 0xffe0b0, intensity: 1.05, pos: [40, 55, 15] },
    hemi: { sky: 0x9aa8c0, ground: 0x55555a, intensity: 0.6 },
    rim: { color: 0xffc090, intensity: 0.45 },
    cloud: { color: 0xc8c0b8, emissive: 0.08 },
    weather: null,
    city: true,            // main.js spawns destructible buildings
    flat: true,            // flat ground so streets and blocks sit level
    vehicleType: 'car',    // streets full of cars instead of safari jeeps
    objective: { kind: 'topple', value: 20, text: 'Topple 20 buildings' },
  },

  nightCity: {
    key: 'nightCity',
    name: 'Night City',
    desc: 'After-hours rampage',
    icon: '🌃',
    biomeColors: {
      forest: 0x1a3a3a,
      swamp:  0x1a1f2a,
      desert: 0x232830,
    },
    sky: { top: 0x06091a, mid: 0x14203a, bottom: 0x2a1830, glow: [0.08, 0.05, 0.10] },
    fog: { color: 0x12182a, density: 0.013 },
    sun: { color: 0x88a4d8, intensity: 0.35, pos: [-20, 50, -20] },
    hemi: { sky: 0x1a2a45, ground: 0x10131a, intensity: 0.35 },
    rim: { color: 0xffa84a, intensity: 0.7 }, // warm streetlamp rim
    cloud: { color: 0x4a5070, emissive: 0.08 },
    weather: null,
    city: true,
    flat: true,
    nightCity: true,         // buildings get emissive windows
    vehicleType: 'car',
    objective: { kind: 'topple', value: 30, text: 'Crush 30 buildings in the dark' },
  },

  night: {
    key: 'night',
    name: 'Night Forest',
    desc: 'Moonlight & fireflies',
    icon: '🌙',
    biomeColors: {
      forest: 0x1a3a2a,
      swamp:  0x1a2a3a,
      desert: 0x3a2a4a,
    },
    sky: { top: 0x050a20, mid: 0x1a2a4a, bottom: 0x4a3a6a, glow: [0.05, 0.04, 0.10] },
    fog: { color: 0x1a2a3a, density: 0.013 },
    sun: { color: 0x9aaadd, intensity: 0.45, pos: [-20, 50, -20] }, // "moon"
    hemi: { sky: 0x2a3a5a, ground: 0x1a2a1a, intensity: 0.4 },
    rim: { color: 0x88aaff, intensity: 0.55 },
    cloud: { color: 0x6a7090, emissive: 0.1 },
    weather: 'fireflies',
    objective: { kind: 'hatchBabies', value: 3, text: 'Hatch 3 baby dinos' },
  },

  // ---------- Phase F: Titan-themed expansion levels ----------

  harbor: {
    key: 'harbor',
    name: 'Harbor Assault',
    desc: 'Walk out of the sea, smash the docks',
    icon: '⚓',
    // Seafloor colors — visible through wave troughs so the ground
    // reads as muted seabed instead of sandy beach poking through.
    biomeColors: {
      forest: 0x2a4858,
      swamp:  0x1f3a4a,
      desert: 0x4a5c6a,
    },
    sky: { top: 0x2a4a6a, mid: 0x7aa8c4, bottom: 0xe0c898, glow: [0.14, 0.12, 0.08] },
    fog: { color: 0xaac0c8, density: 0.013 },
    sun: { color: 0xfff0c8, intensity: 1.0, pos: [25, 55, 25] },
    hemi: { sky: 0x88a0c0, ground: 0x4a6a6a, intensity: 0.65 },
    rim: { color: 0xa0c0e0, intensity: 0.45 },
    cloud: { color: 0xeaeaea, emissive: 0.1 },
    weather: null,
    flat: true,
    aquatic: true,      // no trees/grass/cacti — open seascape
    harbor: true,       // main.js spawns oil rigs + boats
    objective: { kind: 'topple', value: 4, text: 'Topple 4 oil rigs' },
  },

  military: {
    key: 'military',
    name: 'Military Base',
    desc: 'Tanks. Jets. Eat them all.',
    icon: '🪖',
    biomeColors: {
      forest: 0x6a7058,
      swamp:  0x5a5048,
      desert: 0x988a6a,   // dusty tarmac
    },
    sky: { top: 0x4a5a7a, mid: 0x9aa8b8, bottom: 0xc0b89a, glow: [0.16, 0.13, 0.07] },
    fog: { color: 0xb8b09a, density: 0.012 },
    sun: { color: 0xfff0c8, intensity: 1.0, pos: [30, 55, 20] },
    hemi: { sky: 0xa0b0c0, ground: 0x55554a, intensity: 0.6 },
    rim: { color: 0xffd0a0, intensity: 0.4 },
    cloud: { color: 0xcfcabb, emissive: 0.08 },
    weather: null,
    flat: true,
    military: true,     // spawns radar dishes + extra ground military
    objective: { kind: 'destroyGround', value: 8, text: 'Destroy 8 tanks' },
  },

  megacity: {
    key: 'megacity',
    name: 'Skyscraper Megacity',
    desc: 'Towers as far as the eye sees',
    icon: '🌆',
    biomeColors: {
      forest: 0x4a5a4a,
      swamp:  0x3a3f47,
      desert: 0x6a6f78,
    },
    sky: { top: 0x2a3a5a, mid: 0x7a8aa8, bottom: 0xe0a888, glow: [0.22, 0.13, 0.06] },
    fog: { color: 0xb0a89c, density: 0.013 },
    sun: { color: 0xffe0b0, intensity: 1.05, pos: [40, 55, 15] },
    hemi: { sky: 0x9aa8c0, ground: 0x55555a, intensity: 0.6 },
    rim: { color: 0xffc090, intensity: 0.5 },
    cloud: { color: 0xc8c0b8, emissive: 0.08 },
    weather: null,
    city: true,
    flat: true,
    megacity: true,        // taller buildings + landmark towers
    vehicleType: 'car',
    objective: { kind: 'topple', value: 50, text: 'Topple 50 skyscrapers' },
  },

  powerPlant: {
    key: 'powerPlant',
    name: 'Power Plant',
    desc: 'Drink the reactors',
    icon: '☢️',
    biomeColors: {
      forest: 0x5a6a3a,
      swamp:  0x4a5a48,
      desert: 0x88846a,
    },
    sky: { top: 0x2a3a5a, mid: 0x6a8aa8, bottom: 0xc8d8a8, glow: [0.10, 0.16, 0.10] },
    fog: { color: 0xb0c0b0, density: 0.013 },
    sun: { color: 0xeaffd8, intensity: 0.95, pos: [30, 55, 20] },
    hemi: { sky: 0xaac0b0, ground: 0x5a6a4a, intensity: 0.65 },
    rim: { color: 0x88ff66, intensity: 0.55 }, // greenish hum
    cloud: { color: 0xd0d8c8, emissive: 0.08 },
    weather: null,
    flat: true,
    powerPlant: true,      // reactor cores + cooling towers
    objective: { kind: 'reactorsEaten', value: 4, text: 'Absorb 4 reactor cores' },
  },

  highway: {
    key: 'highway',
    name: 'Mountain Highway',
    desc: 'Crush the convoy',
    icon: '🛣️',
    biomeColors: {
      forest: 0x4a6a4a,
      swamp:  0x6a5a3a,
      desert: 0x988a6a,
    },
    sky: { top: 0x3a5a8a, mid: 0xa8c0d4, bottom: 0xe8d0a8, glow: [0.14, 0.12, 0.08] },
    fog: { color: 0xc0b8a4, density: 0.012 },
    sun: { color: 0xfff0c8, intensity: 1.05, pos: [25, 55, 25] },
    hemi: { sky: 0xa8c0d0, ground: 0x55504a, intensity: 0.65 },
    rim: { color: 0xffd6a0, intensity: 0.4 },
    cloud: { color: 0xe8e8e8, emissive: 0.1 },
    weather: null,
    highway: true,         // big-rig truck spawns + bridge landmarks
    vehicles: true,
    vehicleType: 'car',
    objective: { kind: 'chompVehicles', value: 10, text: 'Crush 10 trucks' },
  },

  lavaThrone: {
    key: 'lavaThrone',
    name: 'Lava Throne',
    desc: 'Titan home turf',
    icon: '🔥',
    biomeColors: {
      forest: 0x4a1a14,
      swamp:  0x6a2a1a,
      desert: 0x8a3a2a,
    },
    sky: { top: 0x1a0510, mid: 0x4a1a1a, bottom: 0xff5a2a, glow: [0.35, 0.16, 0.05] },
    fog: { color: 0x6a2a1a, density: 0.018 },
    sun: { color: 0xff7a55, intensity: 1.1, pos: [30, 55, 20] },
    hemi: { sky: 0xaa3a2a, ground: 0x6a1a14, intensity: 0.7 },
    rim: { color: 0xff5a3a, intensity: 0.7 },
    cloud: { color: 0x3a1a1a, emissive: 0.05 },
    weather: 'embers',
    lavaThrone: true,      // lava pool hazards + eruption vents
    objective: { kind: 'kaijuDowned', value: 2, text: 'Defeat 2 kaiju invaders' },
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS);

let _current = 'lostWorld';
export function getLevel() { return LEVELS[_current]; }
export function getLevelKey() { return _current; }
export function setLevelKey(k) {
  if (LEVELS[k]) _current = k;
}
