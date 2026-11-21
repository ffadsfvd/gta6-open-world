// How people look: skin, hair, shirt and trouser palettes for the crowd, and fixed outfits for
// the player, the police, Crane's crew and the named cast.

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d4a373', '#a8754c', '#6f4a2f'];
const HAIR = ['#1b1b1b', '#3b2a1a', '#5a3a22', '#8a5a2b', '#c8a165', '#e6cf9a', '#7a2e1d', '#2f2f3a'];
const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#f7fff7', '#1a535c', '#ff9f1c', '#c5d86d', '#e56b6f', '#6d597a', '#90e0ef', '#ffafcc', '#ffffff', '#3a86ff', '#f4f1de'];
const PANTS = ['#2b2d42', '#3d405b', '#6c757d', '#e9edc9', '#14213d', '#8d99ae', '#5e548e', '#d4a373', '#264653', '#f1faee'];

export const OUTFITS = {
  player: { skin: '#c68642', hair: '#1b1b1b', shirt: '#f7f3e8', pants: '#2c4a73', hat: null },
  police: { skin: '#e0ac69', hair: '#2f2f3a', shirt: '#203a66', pants: '#1a1f2c', hat: '#1a1f2c' },
  gang: { skin: '#a8754c', hair: '#1b1b1b', shirt: '#b5121b', pants: '#1c1c1c', hat: null },
  lou: { skin: '#c68642', hair: '#d9d9d9', shirt: '#ff7aa2', pants: '#3d405b', hat: null },
  juno: { skin: '#f1c27d', hair: '#3b2a1a', shirt: '#2ec4b6', pants: '#22223b', hat: '#ff9f1c' },
  crane: { skin: '#ffdbac', hair: '#e6cf9a', shirt: '#f4f1de', pants: '#e9edc9', hat: '#f4f1de' },
  voss: { skin: '#e0ac69', hair: '#5a3a22', shirt: '#6c757d', pants: '#343a40', hat: null },
  dash: { skin: '#8d5524', hair: '#1b1b1b', shirt: '#ffbe0b', pants: '#14213d', hat: null },
  fare: { skin: '#ffdbac', hair: '#8a5a2b', shirt: '#ff9f1c', pants: '#3d405b', hat: null },
};

export function randomAppearance(rng) {
  return {
    skin: rng.pick(SKIN),
    hair: rng.pick(HAIR),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    hat: rng.chance(0.15) ? rng.pick(['#f4f1de', '#e63946', '#2a9d8f', '#ffbe0b']) : null,
    bald: rng.chance(0.08),
  };
}
