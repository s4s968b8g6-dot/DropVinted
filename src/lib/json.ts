/** Extrait le premier objet ou tableau JSON d'un texte (l'IA ajoute parfois du texte autour). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // on cherche le bloc JSON le plus large
  }
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("Aucun JSON dans la réponse de l'IA.");
  const start = Math.min(...starts);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (end <= start) throw new Error("JSON incomplet dans la réponse de l'IA.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Nombre à partir d'un texte comme "12,50 €" ou "3.99 -- 5.10" (prend la valeur la plus haute si plage). */
export function toNumber(value: unknown, pick: "max" | "min" = "max"): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const nums = (value.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => Number(s.replace(",", ".")));
  if (nums.length === 0) return NaN;
  return pick === "max" ? Math.max(...nums) : Math.min(...nums);
}
