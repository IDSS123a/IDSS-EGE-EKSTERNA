/** The six special gifts approved by the Director (PDL-039, G2). Codes match the database check (migration 032). */
export const GIFT_CODES = ["crystal", "icosahedron", "quill_book", "key", "persistence", "spark"] as const;
export type GiftCode = (typeof GIFT_CODES)[number];

/** The four official IDSS colours (PDL-019) used by every gift. */
export const IDSS_COLORS = { red: "#E8262C", yellow: "#FFCB29", blue: "#035EA1", sky: "#08ABE6" } as const;

/** Longest personal message engraved on a gift (migration 032). */
export const GIFT_MESSAGE_MAX_LENGTH = 200;

export function isGiftCode(value: unknown): value is GiftCode {
  return typeof value === "string" && (GIFT_CODES as readonly string[]).includes(value);
}
