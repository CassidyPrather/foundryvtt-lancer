// Variant rule: player mechs survive at 0 structure / stress and keep rolling the structure damage and
// overheating tables. Structure and stress can't go below 0 in the data model, so hits taken past 0 are
// tracked in a flag, and each one adds a die to the table roll.
import type { LancerActor } from "../actor/lancer-actor";
import { LANCER } from "../config";

export type StrussStat = "structure" | "stress";

const OVERFLOW_FLAGS: Record<StrussStat, string> = {
  structure: "structure_overflow",
  stress: "stress_overflow",
};

/** Whether the variant applies to this actor: player mechs only, and only when the world setting is on. */
export function survivesZeroStruss(actor: LancerActor): boolean {
  return actor.is_mech() && !!game.settings.get(game.system.id, LANCER.setting_pc_survive_zero_struss);
}

/** Number of structure or stress hits the actor has taken past 0. */
export function strussOverflow(actor: LancerActor, stat: StrussStat): number {
  return Number((actor as any).getFlag(game.system.id, OVERFLOW_FLAGS[stat]) ?? 0) || 0;
}

/** Update key for the overflow counter of a stat. */
export function strussOverflowKey(stat: StrussStat): string {
  return `flags.${game.system.id}.${OVERFLOW_FLAGS[stat]}`;
}

/** Remaining structure or stress, counting hits past 0 as negative values. */
export function effectiveStruss(actor: LancerActor, stat: StrussStat): number {
  return ((actor.system as any)[stat]?.value ?? 0) - strussOverflow(actor, stat);
}

/** Note appended to a result the mech survives thanks to the variant rule. */
export function surviveNote(): string {
  return `<p><em>${game.i18n.localize("lancer.pcSurviveZeroStruss.note")}</em></p>`;
}

/**
 * Clear the overflow counters when an update restores structure or stress above 0 (repairs, full repair).
 * Mutates the pending update data. Call from the actor's _preUpdate.
 */
export function resetStrussOverflowOnRepair(actor: LancerActor, data: object) {
  const changes = foundry.utils.expandObject(data) as any;
  for (const stat of ["structure", "stress"] as StrussStat[]) {
    const change = changes.system?.[stat];
    const value = typeof change === "number" ? change : change?.value;
    if (typeof value === "number" && value > 0 && strussOverflow(actor, stat) > 0) {
      foundry.utils.setProperty(data, strussOverflowKey(stat), 0);
    }
  }
}
