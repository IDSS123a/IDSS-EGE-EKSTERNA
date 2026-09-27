#!/usr/bin/env node
/**
 * Enforces the app text style rule (CONSTITUTION P-13) on every text the app shows:
 * interface dictionaries, splash messages and markup, and string/JSX text in src/**\/*.tsx.
 * Rules are data in config/app-text-style.json (shared with src/lib/text-style.ts).
 * Code comments and canonical source text are not app text and are not scanned.
 * Exit code 1 on any violation (used by CI and npm run check:text).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const rules = JSON.parse(readFileSync(join(root, "config/app-text-style.json"), "utf8"));
const emoji = /\p{Extended_Pictographic}/u;

function walk(dir, predicate, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, predicate, out);
    else if (predicate(path)) out.push(path);
  }
  return out;
}

/** JSON string values, skipping metadata keys that start with "_" (not shown to users). */
function jsonTexts(value, key = "") {
  if (key.startsWith("_")) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => jsonTexts(item));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => jsonTexts(v, k));
  return [];
}

/** Source text without comments (block comments, JSX comments, line comments not inside URLs). */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const targets = [
  ...walk(join(root, "src/features/localization/messages"), (p) => p.endsWith(".json")).map((p) => [p, jsonTexts(JSON.parse(readFileSync(p, "utf8")))]),
  [join(root, "public/splash/messages.json"), jsonTexts(JSON.parse(readFileSync(join(root, "public/splash/messages.json"), "utf8")))],
  [join(root, "public/splash/index.html"), [readFileSync(join(root, "public/splash/index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "")]],
  ...walk(join(root, "src"), (p) => p.endsWith(".tsx")).map((p) => [p, [withoutComments(readFileSync(p, "utf8"))]]),
];

const problems = [];
for (const [file, texts] of targets) {
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const rule of rules.forbiddenCharacters) if (text.includes(rule.char)) problems.push(`${relative(root, file)}: ${rule.name} "${rule.char}"`);
    if (rules.forbidEmoji && emoji.test(text)) problems.push(`${relative(root, file)}: emoji`);
    for (const phrase of rules.forbiddenPhrases) if (lower.includes(phrase.toLowerCase())) problems.push(`${relative(root, file)}: AI phrasing "${phrase}"`);
  }
}

if (problems.length > 0) {
  console.error(`App text style rule (CONSTITUTION P-13) violated:\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
console.log(`App text style rule (P-13): ${targets.length} files clean.`);
