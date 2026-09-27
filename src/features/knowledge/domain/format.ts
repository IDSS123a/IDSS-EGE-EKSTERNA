/**
 * Readable form of a canonical rule value for reviewers, e.g. { minutes: 60 } as "minuta: 60".
 * Keys and known word values are looked up in the interface dictionary; anything unknown is shown
 * as stored. Framework-free so it can be unit-tested.
 */
export function formatRuleValue(value: unknown, keys: Record<string, string>, words: Record<string, string>): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return words[String(value)] ?? String(value);
  if (typeof value === "number") return String(value).replace(".", ",");
  if (typeof value === "string") return words[value] ?? value;
  if (Array.isArray(value)) {
    const parts = value.map((item) => formatRuleValue(item, keys, words));
    return value.some((item) => typeof item === "object" && item !== null) ? parts.join("; ") : parts.join(", ");
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      // "..._per_area": [first, last] is an inclusive range of catalogue task numbers ("1 do 5").
      const range = key.endsWith("_per_area") && Array.isArray(item) && item.length === 2 && words.range;
      const text = range ? `${formatRuleValue(item[0], keys, words)} ${words.range} ${formatRuleValue(item[1], keys, words)}` : formatRuleValue(item, keys, words);
      return typeof item === "object" && item !== null && !Array.isArray(item) ? `${keys[key] ?? key} (${text})` : `${keys[key] ?? key}: ${text}`;
    })
    .join(", ");
}
