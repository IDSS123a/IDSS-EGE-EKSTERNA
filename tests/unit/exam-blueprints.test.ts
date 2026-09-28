import { describe, expect, it } from "vitest";
import blueprints from "../../config/exam-blueprints.json";
import facts from "../../config/canonical-facts.json";

type Pool = { key: string; from: number; to: number };
type Position = {
  position: number;
  format: string;
  scoring: string;
  points: number;
  item_points?: number;
  items?: number;
  part_points?: number;
  pool: Pool[];
  observed?: string[];
};

/** Confirmed rule value of a subject's catalogue edition (canonical facts, PDL-015). */
function rule(subject: string, code: string): Record<string, unknown> {
  const edition = facts.editions.find((entry) => entry.subject.code === subject);
  const found = edition?.rules.find((entry) => entry.code === code);
  if (!found) throw new Error(`${subject}: rule ${code} missing`);
  return found.value as Record<string, unknown>;
}

const subjects = blueprints.subjects as Record<string, { distinct_area: boolean; positions: Position[] }>;

describe("mock exam blueprints (PDL-026)", () => {
  it("cover the three subjects only", () => {
    expect(Object.keys(subjects).sort()).toEqual(["bhs_language_literature", "german", "mathematics"]);
  });

  for (const [subject, blueprint] of Object.entries(subjects)) {
    describe(subject, () => {
      it("add up to the confirmed total points", () => {
        const total = blueprint.positions.reduce((sum, position) => sum + position.points, 0);
        expect(total).toBe(rule(subject, "exam.total_points").points);
      });

      it("number positions 1 to n without gaps", () => {
        expect(blueprint.positions.map((position) => position.position)).toEqual(blueprint.positions.map((_, index) => index + 1));
      });

      it("have consistent points per item and part, and valid pools", () => {
        for (const position of blueprint.positions) {
          if (position.scoring === "per_item") expect((position.items ?? 0) * (position.item_points ?? 0)).toBe(position.points);
          if (position.scoring === "parts") expect((position.part_points ?? 0) * 2).toBe(position.points);
          expect(position.pool.length).toBeGreaterThan(0);
          for (const pool of position.pool) {
            expect(() => new RegExp(pool.key)).not.toThrow();
            expect(pool.from).toBeLessThanOrEqual(pool.to);
          }
        }
      });

      it("include every task observed in the official tests in the position's pool", () => {
        for (const position of blueprint.positions) {
          for (const observed of (position.observed ?? []).flatMap((entry) => entry.split(" "))) {
            const number = Number(observed.replace(/#.*$/, "").split(".").pop());
            expect(position.pool.some((pool) => number >= pool.from && number <= pool.to), `${subject} ${position.position}: ${observed}`).toBe(true);
          }
        }
      });
    });
  }

  it("match the confirmed composition rules", () => {
    expect(subjects.bhs_language_literature.positions).toHaveLength(rule("bhs_language_literature", "exam.task_count").tasks as number);
    expect(subjects.mathematics.positions).toHaveLength(rule("mathematics", "exam.task_count").tasks as number);
    const composition = rule("bhs_language_literature", "exam.composition");
    const count = (format: string) => subjects.bhs_language_literature.positions.filter((position) => position.format === format).length;
    expect(count("choice")).toBe(composition.multiple_choice_single_answer);
    expect(count("completion")).toBe(composition.completion_or_short_answer);
    expect(count("matching")).toBe(composition.matching);
    const areas = rule("german", "exam.area_points").areas as Record<string, number>;
    for (const position of subjects.german.positions as (Position & { label: string })[]) expect(position.points).toBe(areas[position.label]);
    expect(subjects.german.positions.every((position) => position.item_points === rule("german", "exam.scoring").item_points)).toBe(true);
    const math = rule("mathematics", "exam.scoring");
    for (const position of subjects.mathematics.positions) {
      if (position.position <= 8) expect(position.points).toBe(math.tasks_1_to_8_points);
      else expect(position.part_points).toBe(math.tasks_9_and_10_points_per_part);
    }
  });
});
