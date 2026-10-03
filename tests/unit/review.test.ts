import { describe, expect, it } from "vitest";
import type { CurrentAccount } from "@/features/authentication/types";
import { formatRuleValue } from "@/features/knowledge/domain/format";
import { knowledgeErrorFromDatabase } from "@/features/knowledge/domain/errors";
import { reviewErrorFromDatabase } from "@/features/review/domain/errors";
import { countStates, defaultFilter, filterQueue, findByKey, neighbours, pageOf, parseFilter, regionOnPage, reviewState } from "@/features/review/domain/queue";
import type { QueueItem } from "@/features/review/types";
import { buildContentSecurityPolicy } from "@/features/security/csp";
import { canOpenReview, canReviewSubject, hasSubjectCapability } from "@/lib/permissions";
import { BundleChangeSchema, ErratumSchema, ErratumWithdrawalSchema, FollowUpSchema, RecordDecisionSchema, RuleReviewSchema } from "@/lib/validation/schemas";

const MATH = "11111111-1111-4111-8111-111111111111";
const GERMAN = "22222222-2222-4222-8222-222222222222";

function account(scopes: [string, "all" | string[]][], role: CurrentAccount["role"] = "administrator"): CurrentAccount {
  const subjectScopes = new Map(scopes.map(([code, scope]) => [code, scope === "all" ? ("all" as const) : new Set(scope)]));
  return { userId: "u", username: "x", displayName: "X", role, status: "active", capabilities: new Set(subjectScopes.keys()), subjectScopes };
}

const item = (recordId: number, state: QueueItem["state"], ordinal = recordId): QueueItem => ({
  recordId, recordKey: `MAT-5.1.${recordId}`, ordinal, recordKind: "official_catalogue_question", structuralStatus: "passed", taskType: null, area: null, state,
});

describe("review queue rules", () => {
  it("derives the state from decisions: accepted wins, else returned, else pending", () => {
    expect(reviewState([])).toBe("pending");
    expect(reviewState([{ decision: "returned", decidedAt: "2026-09-27T10:00:00Z" }])).toBe("returned");
    expect(reviewState([{ decision: "accepted", decidedAt: "2026-09-27T09:00:00Z" }, { decision: "returned", decidedAt: "2026-09-27T10:00:00Z" }])).toBe("accepted");
  });

  it("filters in source order, counts and pages", () => {
    const items = [item(3, "pending"), item(1, "accepted"), item(2, "pending"), item(4, "returned")];
    expect(filterQueue(items, "pending").map((entry) => entry.recordId)).toEqual([2, 3]);
    expect(filterQueue(items, "all")).toHaveLength(4);
    expect(countStates(items)).toEqual({ pending: 2, returned: 1, accepted: 1 });
    expect(pageOf([1, 2, 3, 4, 5], 2, 2)).toEqual({ items: [3, 4], page: 2, pages: 3 });
    expect(pageOf([1, 2, 3], 99, 2).page).toBe(2);
    expect(pageOf([], 1, 25)).toEqual({ items: [], page: 1, pages: 1 });
    expect(pageOf([1], Number.NaN, 25).page).toBe(1);
  });

  it("navigates to neighbours, and to the first open record after a decision", () => {
    const items = [item(1, "pending"), item(2, "pending"), item(3, "pending")];
    expect(neighbours(items, 2)).toEqual({ previous: 1, next: 3 });
    expect(neighbours(items, 9)).toEqual({ previous: null, next: 1 });
    expect(neighbours([], 9)).toEqual({ previous: null, next: null });
  });

  it("parses the filter, defaulting to pending", () => {
    expect(parseFilter("accepted")).toBe("accepted");
    expect(parseFilter("anything")).toBe("pending");
    expect(parseFilter(undefined)).toBe("pending");
  });

  it("widens the record region on its page and clamps it at the page edge", () => {
    const regions = [{ page: 23, bbox: [72, 194.9, 540, 302.9] as [number, number, number, number] }, { page: 24, bbox: [5, 5, 50, 50] as [number, number, number, number] }];
    expect(regionOnPage(regions, 23, 12)).toEqual([60, 182.9, 552, 314.9]);
    expect(regionOnPage(regions, 24, 12)).toEqual([0, 0, 62, 62]);
    expect(regionOnPage(regions, 25, 12)).toBeNull();
  });
});

describe("subject-scoped permissions (twin of private.has_capability with subject)", () => {
  const mathTeacher = account([["canon.review", [MATH]], ["answer_keys.propose_revision", [MATH]], ["accounts.view", "all"]]);
  const superadmin = account([["canon.publish", "all"], ["canon.review", "all"], ["answer_keys.propose_revision", "all"]], "superadmin");
  const pedagogue = account([["students.view_progress", "all"]]);

  it("scopes review, errata and follow-ups to the teacher's subject", () => {
    expect(canReviewSubject(mathTeacher, MATH)).toBe(true);
    expect(canReviewSubject(mathTeacher, GERMAN)).toBe(false);
    expect(hasSubjectCapability(mathTeacher, "accounts.view", GERMAN)).toBe(true);
  });

  it("lets publishers review every subject and keeps others out", () => {
    expect(canReviewSubject(superadmin, GERMAN)).toBe(true);
    expect(canOpenReview(mathTeacher)).toBe(true);
    expect(canOpenReview(pedagogue)).toBe(false);
    expect(canReviewSubject(pedagogue, MATH)).toBe(false);
  });
});

describe("review validation", () => {
  it("accepting needs a known task type, returning needs a reason", () => {
    expect(RecordDecisionSchema.safeParse({ recordId: "12", decision: "accepted", taskType: "matching" }).success).toBe(true);
    expect(RecordDecisionSchema.safeParse({ recordId: "12", decision: "accepted", taskType: "" }).success).toBe(false);
    expect(RecordDecisionSchema.safeParse({ recordId: "12", decision: "accepted", taskType: "invented_type" }).success).toBe(false);
    expect(RecordDecisionSchema.safeParse({ recordId: "12", decision: "returned", reason: "   " }).success).toBe(false);
    expect(RecordDecisionSchema.safeParse({ recordId: "12", decision: "returned", reason: "Opcija d) nedostaje" }).success).toBe(true);
    expect(RecordDecisionSchema.safeParse({ recordId: "-1", decision: "returned", reason: "x" }).success).toBe(false);
  });

  it("a dispute needs a note", () => {
    expect(RuleReviewSchema.safeParse({ ruleId: MATH, subjectId: MATH, decision: "confirmed" }).success).toBe(true);
    expect(RuleReviewSchema.safeParse({ ruleId: MATH, subjectId: MATH, decision: "disputed", note: "" }).success).toBe(false);
  });

  it("an erratum needs description and evidence; the item is optional (P-15)", () => {
    const erratum = { questionVersionId: MATH, subjectId: MATH, description: "Salzburg liegt in Österreich", evidence: "Štampani ključ a)" };
    expect(ErratumSchema.parse({ ...erratum, itemNumber: "" }).itemNumber).toBeUndefined();
    expect(ErratumSchema.parse({ ...erratum, itemNumber: "3" }).itemNumber).toBe(3);
    expect(ErratumSchema.safeParse({ ...erratum, itemNumber: "0" }).success).toBe(false);
    expect(ErratumSchema.safeParse({ ...erratum, evidence: "  " }).success).toBe(false);
    expect(ErratumWithdrawalSchema.safeParse({ erratumId: MATH, subjectId: MATH, reason: "" }).success).toBe(false);
    expect(FollowUpSchema.safeParse({ questionVersionId: MATH, subjectId: MATH, assignee: "Nikolina Todorović", note: "Privremeno prihvaćeno" }).success).toBe(true);
    expect(FollowUpSchema.safeParse({ questionVersionId: MATH, subjectId: MATH, assignee: " ", note: "x" }).success).toBe(false);
  });

  it("a subject-teacher grant always names a subject, other bundles never do", () => {
    expect(BundleChangeSchema.safeParse({ userId: MATH, bundle: "subject_teacher", subjectId: GERMAN, grant: "grant" }).success).toBe(true);
    expect(BundleChangeSchema.safeParse({ userId: MATH, bundle: "subject_teacher", grant: "grant" }).success).toBe(false);
    expect(BundleChangeSchema.safeParse({ userId: MATH, bundle: "pedagogue", subjectId: GERMAN, grant: "grant" }).success).toBe(false);
  });
});

describe("rule values and database messages", () => {
  const keys = { minutes: "minuta", positions: "pozicije", from: "od", to: "do", catalogue_tasks_per_area: "zadaci kataloga", multiple_choice_option_counts: "broj odgovora", aids: "pomagala" };
  const words = { calculator: "kalkulator", eraser: "gumica", true: "da", false: "ne", range: "do" };

  it("formats rule values readably without inventing anything", () => {
    expect(formatRuleValue({ minutes: 60 }, keys, words)).toBe("minuta: 60");
    expect(formatRuleValue({ aids: ["calculator", "eraser"] }, keys, words)).toBe("pomagala: kalkulator, gumica");
    expect(formatRuleValue({ points: 0.5 }, keys, words)).toBe("points: 0,5");
    expect(formatRuleValue({ positions: [{ from: 1, to: 4, catalogue_tasks_per_area: [1, 5] }] }, keys, words)).toBe("pozicije: od: 1, do: 4, zadaci kataloga: 1 do 5");
    expect(formatRuleValue({ multiple_choice_option_counts: [3, 4] }, keys, words)).toBe("broj odgovora: 3, 4");
  });

  it("maps database machine messages and nothing else", () => {
    expect(reviewErrorFromDatabase("ALREADY_ACCEPTED")).toBe("ALREADY_ACCEPTED");
    expect(reviewErrorFromDatabase("duplicate key value violates unique constraint")).toBe("UNAVAILABLE");
    expect(knowledgeErrorFromDatabase("ALREADY_LOADED")).toBe("ALREADY_LOADED");
    expect(knowledgeErrorFromDatabase("QUOTE_MISMATCH")).toBe("UNAVAILABLE");
  });

  it("the CSP allows only same-origin workers (pdf.js)", () => {
    expect(buildContentSecurityPolicy("n", false)).toContain("worker-src 'self'");
  });
});

describe("review queue navigation", () => {
  const keyed = (recordId: number, recordKey: string): QueueItem => ({ ...item(recordId, "accepted"), recordKey });
  const items = [keyed(1, "MAT-5.3.5"), keyed(2, "MAT-5.3.50"), keyed(3, "MAT-5.10.6"), keyed(4, "MAT-5.10.60")];

  it("shows everything once nothing waits, and an explicit filter still wins", () => {
    expect(defaultFilter({ pending: 0, returned: 0, accepted: 200 })).toBe("all");
    expect(defaultFilter({ pending: 3, returned: 0, accepted: 197 })).toBe("pending");
    expect(parseFilter(undefined, "all")).toBe("all");
    expect(parseFilter("pending", "all")).toBe("pending");
  });

  it("finds a record by its full or short key, exact match first", () => {
    expect(findByKey(items, "MAT-5.3.5").map((entry) => entry.recordId)).toEqual([1]);
    expect(findByKey(items, " 5.3.5 ").map((entry) => entry.recordId)).toEqual([1]);
    expect(findByKey(items, "mat-5.10.6").map((entry) => entry.recordId)).toEqual([3]);
    expect(findByKey(items, "5.10").map((entry) => entry.recordId)).toEqual([3, 4]);
    expect(findByKey(items, "   ")).toEqual([]);
    expect(findByKey(items, "DEU-1")).toEqual([]);
  });
});
