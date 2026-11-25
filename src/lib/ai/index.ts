// Couche IA interchangeable : Gemini (par défaut) ou Claude, choisi par la variable AI_PROVIDER.
import "server-only";
import type { Usage } from "../types";
import { extractJson } from "../json";
import { AiError, type AiRequest, type AiResponse } from "./core";
import { geminiGenerate } from "./gemini";
import { anthropicGenerate } from "./anthropic";

export { AiError } from "./core";
export type { AiRequest, AiResponse } from "./core";

export type AiProvider = "gemini" | "anthropic";

export function getAiProvider(): AiProvider | null {
  const wanted = (process.env.AI_PROVIDER || "").toLowerCase();
  if (wanted === "anthropic" || wanted === "claude") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (wanted === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function maxSearches(): number {
  const n = Number(process.env.MAX_WEB_SEARCHES);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 5;
}

export async function generate(req: AiRequest): Promise<AiResponse> {
  const provider = getAiProvider();
  if (!provider) {
    throw new AiError(
      "Aucune clé IA configurée. Ajoute GEMINI_API_KEY (ou ANTHROPIC_API_KEY) dans les variables d'environnement.",
      400,
    );
  }
  const r = { maxSearches: maxSearches(), ...req };
  return provider === "gemini" ? geminiGenerate(r) : anthropicGenerate(r);
}

/** Appelle l'IA, lit le JSON et le valide ; une seule relance si le JSON est invalide. */
export async function generateJson<T>(
  req: AiRequest,
  parse: (data: unknown) => T,
): Promise<{ data: T; usage: Usage }> {
  const total: Usage = { inputTokens: 0, outputTokens: 0, searches: 0 };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? req.prompt
        : `${req.prompt}\n\nATTENTION : ta réponse précédente n'était pas un JSON valide. Réponds UNIQUEMENT avec le JSON demandé, sans texte autour.`;
    const res = await generate({ ...req, prompt, json: true });
    total.inputTokens += res.usage.inputTokens;
    total.outputTokens += res.usage.outputTokens;
    total.searches += res.usage.searches;
    try {
      return { data: parse(extractJson(res.text)), usage: total };
    } catch (e) {
      lastError = e;
    }
  }
  throw new AiError(
    `L'IA a renvoyé une réponse illisible deux fois de suite. Réessaie. (${lastError instanceof Error ? lastError.message.slice(0, 200) : ""})`,
    502,
  );
}
