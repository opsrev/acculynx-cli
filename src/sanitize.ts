// Strip non-ASCII from outgoing text so AccuLynx doesn't 500 on em-dashes,
// smart quotes, and other Unicode "slop". Transliterate the readable offenders,
// deburr accented Latin, then drop anything left that has no ASCII equivalent.

// Offenders that have no useful Unicode (de)composition, mapped by hand.
const PUNCTUATION: Record<string, string> = {
  "‒": "-", // figure dash
  "–": "-", // en dash
  "—": "-", // em dash
  "―": "-", // horizontal bar
  "‘": "'", // left single quote
  "’": "'", // right single quote
  "′": "'", // prime
  "“": '"', // left double quote
  "”": '"', // right double quote
  "″": '"', // double prime
};

const PUNCTUATION_RE = new RegExp(`[${Object.keys(PUNCTUATION).join("")}]`, "g");

export function toAscii(s: string): string {
  return s
    .replace(PUNCTUATION_RE, (ch) => PUNCTUATION[ch])
    // NFKD turns "é" -> "e" + combining mark, "…" -> "...", NBSP -> space.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip the combining marks NFKD produced
    .replace(/[^\x00-\x7F]/g, "") // backstop: drop any remaining non-ASCII
    .replace(/ {2,}/g, " ") // collapse gaps left by stripped characters
    .trim();
}

export function sanitizeDeep(value: unknown): unknown {
  if (typeof value === "string") return toAscii(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = sanitizeDeep(v);
    return out;
  }
  return value;
}
