import "server-only";
import { createHash } from "node:crypto";
import blueprints from "../../../config/exam-blueprints.json";
import type { BlueprintContent } from "./types";

/**
 * The reviewed blueprints in the repository (config/exam-blueprints.json, PDL-026). The SHA-256 of a subject's entry
 * identifies exactly what a reviewer confirms; the database refuses a different content under the same version.
 */
export const BLUEPRINT_VERSION: string = blueprints.version;

export function blueprintConfig(subjectCode: string): { version: string; sha256: string; content: BlueprintContent } | null {
  const content = (blueprints.subjects as Record<string, BlueprintContent | undefined>)[subjectCode];
  if (!content) return null;
  return { version: BLUEPRINT_VERSION, sha256: createHash("sha256").update(JSON.stringify(content)).digest("hex"), content };
}
