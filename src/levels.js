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
  },

  islaNublar: {
    key: 'islaNublar',
    name: 'Isla Nublar',
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
    centerPeak: {                // Mt. Sibo — visible iconic volcano
      x: -55, z: -55,
      radius: 38,
      height: 42,
    },
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
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS);

let _current = 'lostWorld';
export function getLevel() { return LEVELS[_current]; }
export function getLevelKey() { return _current; }
export function setLevelKey(k) {
  if (LEVELS[k]) _current = k;
}
