import { RangeType } from "../enums";
import type { RangeData } from "../models/bits/range";

type RegionDocument = foundry.documents.RegionDocument;

/** Lancer data stored in the flags of an attack template Region. */
export interface WeaponRangeTemplateFlags {
  range: RangeData;
  creator?: string;
  ignore: { tokens: string[]; dispositions: TokenDocument.Implementation["disposition"][] };
  isAttack?: boolean;
}

/**
 * Places an attack area (Blast, Burst, Cone or Line) on the canvas as a Scene Region.
 *
 * Foundry v14 merged Measured Templates into Regions, so the area is placed with
 * {@link foundry.canvas.layers.RegionLayer#placeRegion} and stored as a RegionDocument with our data
 * in its flags.
 * @example
 * ```javascript
 * const template = WeaponRangeTemplate.fromRange({
 *   type: "Cone",
 *   val: "5",
 * });
 * template?.placeTemplate()
 *   .catch(() => {}) // Handle canceled
 *   .then(region => {
 *     if (region) {
 *       // region is a RegionDocument with flag data
 *     }
 * });
 * ```
 */
export class WeaponRangeTemplate {
  /**
   * The unsaved Region document describing the area. Update its source (e.g. flags) before
   * calling {@link placeTemplate}.
   */
  document: RegionDocument;

  private actorSheet: FormApplication | undefined;

  private constructor(document: RegionDocument) {
    this.document = document;
  }

  get range(): RangeData {
    return (
      (this.document.getFlag(game.system.id, "range") as RangeData | undefined) ?? { type: RangeType.Blast, val: 0 }
    );
  }

  get isBurst() {
    return this.range.type === RangeType.Burst;
  }

  /**
   * Creates a new WeaponRangeTemplate from a provided range object
   * @param range      - Range data
   * @param range.type - Type of template. A RangeType in typescript, or a string in js.
   * @param range.val  - Size of template in grid spaces. A numeric string
   * @param creator    - A token that is designated as the owner of the template.
   *                     Used to deterimine the character sheet to close as well
   *                     as a default ignore target for Cones and Lines.
   */
  static fromRange(
    { type, val }: WeaponRangeTemplate["range"],
    creator?: Token.Implementation
  ): WeaponRangeTemplate | null {
    if (!canvas.ready || !canvas.grid || !canvas.scene) return null;
    const dist = Number(val);
    if (isNaN(dist)) return null;
    const grid = canvas.grid;
    // Shapes are measured in pixels; ranges are measured in grid spaces
    const size = dist * grid.size;
    const gridBased = !grid.isGridless;

    let shape: Record<string, unknown>;
    switch (type) {
      case RangeType.Blast:
        shape = { type: "circle", x: 0, y: 0, radius: size, gridBased };
        break;
      case RangeType.Burst:
        // An emanation measures from the edge of its base, so the Burst radius is just the range
        shape = {
          type: "emanation",
          base: { type: "token", x: 0, y: 0, width: 1, height: 1, shape: CONST.TOKEN_SHAPES.RECTANGLE_1 },
          radius: size,
          gridBased,
        };
        break;
      case RangeType.Cone:
        shape = {
          type: "cone",
          x: 0,
          y: 0,
          radius: size,
          angle: grid.isSquare ? 51 : 59,
          rotation: 0,
          curvature: "round",
          gridBased,
        };
        break;
      case RangeType.Line:
        shape = { type: "line", x: 0, y: 0, length: size, width: grid.size, rotation: 0, gridBased };
        break;
      default:
        return null;
    }

    const flags: WeaponRangeTemplateFlags = {
      range: { type, val },
      creator: creator?.id ?? undefined,
      ignore: {
        tokens: [RangeType.Blast, RangeType.Burst].includes(type) || !creator?.id ? [] : [creator.id],
        dispositions: [],
      },
    };
    const regionData = {
      name: `${type} ${val}`,
      color: game.user!.color,
      shapes: [shape],
      levels: (canvas as any).level ? [(canvas as any).level.id] : [],
      restriction: { enabled: false },
      highlightMode: "coverage",
      displayMeasurements: true,
      visibility: CONST.REGION_VISIBILITY.ALWAYS,
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [game.user!.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
      flags: { [game.system.id]: flags },
    };
    const cls = getDocumentClass("Region");
    const document = new cls(regionData as any, { parent: canvas.scene } as any);
    const template = new this(document as RegionDocument);
    template.actorSheet = creator?.actor?.sheet ?? undefined;
    return template;
  }

  /**
   * Start placement of the template. Left-click places it, right-click or Escape cancels, and the
   * mouse wheel rotates Cones and Lines. Bursts attach to the hovered token.
   * @returns A Promise that resolves to the created RegionDocument, or rejects when placement is
   * canceled or fails.
   */
  async placeTemplate(): Promise<RegionDocument> {
    if (!canvas.ready) {
      ui.notifications?.error("Cannot create WeaponRangeTemplate. Canvas is not ready");
      throw new Error("Cannot create WeaponRangeTemplate. Canvas is not ready");
    }
    const isBurst = this.isBurst;
    const rotatable = [RangeType.Cone, RangeType.Line].includes(this.range.type);
    this.actorSheet?.minimize();
    let region: RegionDocument | null;
    try {
      region = await (canvas as any).regions.placeRegion(this.document.toObject(), {
        attachToToken: isBurst,
        allowRotation: rotatable,
        // Snap to the center of grid spaces rather than to corners and edges
        onMove: ({ shape, position, snap }: { shape: any; position: Canvas.Point; snap: boolean }) => {
          if (isBurst || !snap || canvas.grid!.isGridless) return;
          shape.move(canvas.grid!.getCenterPoint(position), { snap: false });
          return false;
        },
      });
    } finally {
      this.actorSheet?.maximize();
    }
    if (!region) throw new Error("Template creation cancelled");

    // A Burst does not affect the token it emanates from
    // fvtt-types has no v14 release, so it does not know RegionDocument#attachment yet
    const burstToken: string | undefined = isBurst ? (region as any).attachment?.token?.id : undefined;
    if (burstToken) {
      const ignore = foundry.utils.deepClone(
        region.getFlag(game.system.id, "ignore") as WeaponRangeTemplateFlags["ignore"]
      );
      if (!ignore.tokens.includes(burstToken)) ignore.tokens.push(burstToken);
      await region.setFlag(game.system.id, "ignore", ignore);
    }
    return region;
  }
}

declare module "fvtt-types/configuration" {
  interface FlagConfig {
    Region: {
      lancer: WeaponRangeTemplateFlags;
    };
  }
}
