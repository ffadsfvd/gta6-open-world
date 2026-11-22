// The shared materials of the city, each keyed by name: facade styles (with their night-time
// window lights), ground finishes, signs, water, pools and the painted road markings.
import * as THREE from 'three';

/** Materials whose glow follows the time of day, and how bright each gets at full night. */
export const NIGHT_GLOW = { glass: 1.1, deco: 1.25, residential: 1.25, office: 1.15, storefront: 1.5 };

export function createMaterials(textures, signAtlas, windowLights = {}) {
  const standard = (options) => new THREE.MeshStandardMaterial({ vertexColors: true, ...options });
  const lit = (style) => (windowLights[style] ? { emissiveMap: windowLights[style], emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 } : {});
  const materials = {
    glass: standard({ map: textures.glass, roughness: 0.14, metalness: 0.7, envMapIntensity: 1.25, ...lit('glass') }),
    deco: standard({ map: textures.deco, roughness: 0.82, ...lit('deco') }),
    residential: standard({ map: textures.residential, roughness: 0.85, ...lit('residential') }),
    office: standard({ map: textures.office, roughness: 0.6, metalness: 0.1, ...lit('office') }),
    storefront: standard({ map: textures.storefront, roughness: 0.45, metalness: 0.05, ...lit('storefront') }),
    warehouse: standard({ map: textures.warehouse, roughness: 0.7, metalness: 0.2 }),
    plain: standard({ roughness: 0.75 }),
    shiny: standard({ roughness: 0.3, metalness: 0.6 }),
    asphalt: standard({ map: textures.asphalt, roughness: 0.92 }),
    sidewalk: standard({ map: textures.sidewalk, roughness: 0.9 }),
    paving: standard({ map: textures.concrete, roughness: 0.88 }),
    concrete: standard({ map: textures.concrete, roughness: 0.9 }),
    grass: standard({ map: textures.grass, roughness: 1 }),
    plaza: standard({ map: textures.plaza, roughness: 0.7 }),
    sand: standard({ map: textures.sand, roughness: 1 }),
    planks: standard({ map: textures.planks, roughness: 0.85 }),
    markings: standard({ roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    pool: new THREE.MeshStandardMaterial({ color: '#35c6e6', roughness: 0.06, metalness: 0.1, normalMap: textures.waterNormals, normalScale: new THREE.Vector2(0.3, 0.3) }),
    signs: new THREE.MeshStandardMaterial({
      map: signAtlas.texture,
      emissiveMap: signAtlas.texture,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.6,
      roughness: 0.55,
      side: THREE.DoubleSide,
    }),
    foliage: standard({ roughness: 0.9, side: THREE.DoubleSide }),
    glowLamp: new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: new THREE.Color('#ffcf66'), emissiveIntensity: 1.6, roughness: 0.3 }),
  };
  textures.sand.repeat.set(1, 1);
  return materials;
}
