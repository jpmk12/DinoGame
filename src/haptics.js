// Vibration / haptic feedback. iPhones don't support navigator.vibrate
// (only Android does), but Web Vibration API still costs nothing to call
// and lets the game feel chunkier on supported devices.

const SUPPORTED = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrate(ms) {
  if (!SUPPORTED) return;
  try { navigator.vibrate(ms); } catch (e) {}
}

// Named presets for game events
export const tap   = () => vibrate(15);
export const chomp = () => vibrate([25, 20, 25]);
export const stomp = () => vibrate(45);
export const big   = () => vibrate([30, 30, 60]);
export const huge  = () => vibrate([60, 40, 90]);
