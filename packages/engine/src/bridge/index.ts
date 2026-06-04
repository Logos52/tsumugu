/**
 * @tsumugu/engine — bridge module (PRD §5.6).
 *
 * Cross-language bridge registry (cached + correctable private bridge
 * dictionary) and cross-seeding (lift target coverage from known etyma).
 */

export { BridgeRegistry, BRIDGE_SCHEMA } from "./registry.js";
export type { BridgeEntry, BridgeDoc } from "./registry.js";

export { crossSeed } from "./crossseed.js";
export type {
  CrossSeedArgs,
  CrossSeedEntry,
  CrossSeedResult,
  SeededWord,
} from "./crossseed.js";
