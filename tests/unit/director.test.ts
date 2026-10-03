import { describe, expect, it } from "vitest";
import { parseAuditFilter, parsePeriod, parseTab, percentOf, periodStart } from "@/features/director/domain/period";

describe("Director Command Center periods and filters (PDL-040)", () => {
  const now = new Date("2026-10-04T10:00:00Z");

  it("offers 7, 30, 90 days and the school year only when one is active (K3)", () => {
    expect(parsePeriod("90", null)).toBe("90");
    expect(parsePeriod("godina", null)).toBe("30");
    expect(parsePeriod("godina", "2026-09-01")).toBe("godina");
    expect(parsePeriod("x", null)).toBe("30");
    expect(periodStart("7", now, null)).toBe("2026-09-27T10:00:00.000Z");
    expect(periodStart("godina", now, "2026-09-01")).toBe("2026-08-31T22:00:00.000Z");
  });

  it("falls back to the overview tab and drops invalid audit filters", () => {
    expect(parseTab("dnevnik")).toBe("dnevnik");
    expect(parseTab("admin")).toBe("pregled");
    expect(parseAuditFilter({ akcija: "gift.given", osoba: "bad", od: "2026-10-01", do: "2026-13-45", strana: "2" })).toEqual({
      action: "gift.given", person: null, from: "2026-10-01", to: null, page: 2,
    });
    expect(parseAuditFilter({ akcija: "drop table", strana: "-1" }).action).toBeNull();
  });

  it("shows no percentage for hidden or empty figures (K2)", () => {
    expect(percentOf(null, 10)).toBeNull();
    expect(percentOf(3, 0)).toBeNull();
    expect(percentOf(1, 3)).toBe(33);
  });
});
