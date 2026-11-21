// Player settings kept between visits: volumes, mouse sensitivity and inversion, camera shake
// and graphics quality.
import { SETTINGS_KEY } from '../core/config.js';

export const DEFAULT_SETTINGS = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.85,
  sensitivity: 1,
  invertY: false,
  shake: true,
  quality: 'high',
};

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings then last for this visit only.
  }
}
