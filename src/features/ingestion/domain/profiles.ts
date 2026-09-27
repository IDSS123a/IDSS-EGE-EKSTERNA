import profiles from "../../../../config/parser-profiles.json";

/** A parser profile: which extractor reads which exact catalogue edition, and where (PDL-013). */
export type ParserProfile = {
  code: string;
  version: number;
  extractor: "mathematics" | "bhs_language_literature" | "german";
  subject: string;
  id_prefix: string;
  applies_to_sha256: string[];
  header_band: number;
  pages: { tasks: [number, number]; solutions: [number, number]; supplementary?: [number, number] };
  declared_total: number | null;
  declared_source: string;
};

const ALL = profiles.profiles as ParserProfile[];

/** The profile for a file, or null when no reviewed profile exists for that exact edition. */
export function profileForSha256(sha256: string): ParserProfile | null {
  return ALL.find((profile) => profile.applies_to_sha256.includes(sha256)) ?? null;
}

/** All profiles (for reports and tests). */
export function allProfiles(): readonly ParserProfile[] {
  return ALL;
}
