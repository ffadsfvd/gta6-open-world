// Assembles Ondaluz: roads and sidewalks, every block's buildings and set pieces, the coast,
// the hills, street furniture and trees, and keeps the parts that animate or answer questions.
import * as THREE from 'three';
import { CURB_HEIGHT } from '../core/config.js';
import { MeshBuckets } from '../render/meshBuckets.js';
import { forEachBlock } from './cityPlan.js';
import { planBlock } from './blockPlanner.js';
import { addBuilding } from './buildingFactory.js';
import { addFeature } from './blockFeatures.js';
import { buildRoads } from './roadsBuilder.js';
import { buildStreetscape } from './streetscape.js';
import { buildShoreline } from './shoreline.js';
import { buildBackdrop } from './backdrop.js';
import { Vegetation } from './vegetation.js';
import { BreakableProps } from './breakableProps.js';
import { TrafficSignals } from './trafficSignals.js';
import { groundHeight } from './terrain.js';

const GROUND_SCALE = { paving: 6, grass: 6, plaza: 4, concrete: 6 };
const FLAT_BUCKETS = ['signs', 'markings', 'paving', 'grass', 'plaza', 'concrete', 'asphalt', 'pool', 'sidewalk', 'sand', 'planks'];

export function buildCity({ scene, textures, materials, atlas, collision, events, rng }) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const vegetation = new Vegetation();
  const props = new BreakableProps(events);
  const signals = new TrafficSignals();
  const extras = { parkingSpots: [], fountains: [], trees: [] };
  const plans = [];

  const roadBuckets = new MeshBuckets();
  buildRoads(roadBuckets);
  roadBuckets.flush(group, materials, { castShadow: false });

  forEachBlock((bx, bz) => {
    const blockRng = rng.fork(bz * 16 + bx + 1);
    const plan = planBlock(bx, bz, blockRng);
    plans.push(plan);
    const buckets = new MeshBuckets();
    const b = plan.bounds;
    buckets.get(plan.ground).addFloor(b.lotMinX, b.lotMinZ, b.lotMaxX, b.lotMaxZ, CURB_HEIGHT, '#ffffff', GROUND_SCALE[plan.ground]);
    for (const spec of plan.buildings) addBuilding(buckets, atlas, spec, blockRng, collision);
    for (const feature of plan.features) addFeature(buckets, atlas, feature, blockRng, collision, extras);
    for (const tree of plan.trees) vegetation.addTree(tree.kind, tree.x, tree.z, blockRng.range(0, Math.PI * 2), blockRng.range(0.85, 1.25));
    buckets.flush(group, materials, { noShadow: FLAT_BUCKETS });
  });

  const shore = buildShoreline(group, materials, textures, atlas, collision, rng.fork(901));
  addBuilding(shore.buckets, atlas, shore.warehouse, rng.fork(902), collision);
  shore.buckets.flush(group, materials, { noShadow: FLAT_BUCKETS });
  buildBackdrop(group, materials, rng.fork(77));
  // Invisible walls where the hills begin, so nothing drives into the slopes.
  collision.addBox(-372, -372, -346, 300, 80, 'boundary');
  collision.addBox(-372, -372, 262, -346, 80, 'boundary');
  buildStreetscape(group, materials, collision, vegetation, props, signals, rng.fork(55));
  const treeRng = rng.fork(66);
  for (const tree of extras.trees) vegetation.addTree(tree.kind, tree.x, tree.z, treeRng.range(0, Math.PI * 2), 1);
  vegetation.build(group, materials, collision, groundHeight);
  props.build(group, materials, collision);

  return {
    group,
    plans,
    signals,
    props,
    extras,
    lighthouse: shore.lighthouse,
    update(dt, time) {
      signals.update(dt);
      props.update(dt);
      shore.update(dt, time);
    },
  };
}
