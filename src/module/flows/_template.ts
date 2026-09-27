import type { LancerToken } from "../token";
import type { WeaponRangeTemplateFlags } from "../canvas/weapon-range-template";

/**
 * Sets user targets to the visible tokens inside an attack template Region, skipping the tokens
 * and dispositions the template ignores. A token counts as inside when any of the spaces it
 * occupies is inside the Region, which is Foundry's own containment test since v14.
 * @param templateId - The id of the Region placed by WeaponRangeTemplate
 */
export function targetsFromTemplate(templateId: string): void {
  if (!canvas?.ready || !canvas.scene || !canvas.tokens) return;
  const region = canvas.scene.regions.get(templateId);
  if (!region) return;
  const ignore = region.getFlag(game.system.id, "ignore") as WeaponRangeTemplateFlags["ignore"] | undefined;

  const targets = (canvas.tokens.placeables as LancerToken[])
    .filter(t => {
      if (ignore?.tokens.includes(t.id!) || ignore?.dispositions.includes(t.document.disposition)) return false;
      return t.isVisible && t.document.testInsideRegion(region);
    })
    .map(t => t.id!);
  canvas.tokens.setTargets(targets);
}
