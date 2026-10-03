import { describe, expect, it } from "vitest";
import { GIFT_CODES, isGiftCode } from "@/features/gifts/catalogue";
import { engravingLines, phase, UNBOXING } from "@/features/gifts/domain";
import { GiftSchema } from "@/lib/validation/schemas";

describe("special gifts (PDL-039)", () => {
  it("has exactly the six gifts the Director approved (G2)", () => {
    expect(GIFT_CODES).toEqual(["crystal", "icosahedron", "quill_book", "key", "persistence", "spark"]);
    expect(isGiftCode("trophy")).toBe(false);
  });

  it("wraps the engraving at word boundaries", () => {
    expect(engravingLines("Odličan napredak u geometriji ove sedmice. Samo tako nastavi!", 30)).toEqual([
      "Odličan napredak u geometriji",
      "ove sedmice. Samo tako",
      "nastavi!",
    ]);
    expect(engravingLines("   ")).toEqual([]);
  });

  it("runs the unboxing phases in order and eases each one", () => {
    expect(UNBOXING.wobbleEnd).toBeLessThan(UNBOXING.lidEnd);
    expect(UNBOXING.lidEnd).toBeLessThan(UNBOXING.burstEnd);
    expect(UNBOXING.burstEnd).toBeLessThan(UNBOXING.assembleEnd);
    expect(UNBOXING.assembleEnd).toBeLessThan(UNBOXING.sweepEnd);
    expect(phase(0, 1, 2)).toBe(0);
    expect(phase(1.5, 1, 2)).toBe(0.5);
    expect(phase(3, 1, 2)).toBe(1);
  });

  it("accepts a gift with a message of 1 to 200 characters", () => {
    const base = { personId: "22222222-2222-4222-8222-22222222222c", code: "spark", message: "Bravo" };
    expect(GiftSchema.safeParse(base).success).toBe(true);
    expect(GiftSchema.safeParse({ ...base, message: " " }).success).toBe(false);
    expect(GiftSchema.safeParse({ ...base, message: "x".repeat(201) }).success).toBe(false);
    expect(GiftSchema.safeParse({ ...base, code: "trophy" }).success).toBe(false);
  });
});
