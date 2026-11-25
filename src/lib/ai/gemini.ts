import "server-only";
import { AiError, type AiRequest, type AiResponse } from "./core";

const DEFAULT_MODEL = "gemini-flash-latest";

export async function geminiGenerate(req: AiRequest): Promise<AiResponse> {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig: { temperature: 0.6 },
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  if (req.search) {
    body.tools = [{ google_search: {} }];
  } else if (req.json) {
    (body.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(
      `${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      },
    );
  } catch (e) {
    console.error("Gemini fetch", e);
    throw new AiError("Gemini ne répond pas (délai dépassé ou réseau). Réessaie dans un instant.", 504);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message ?? "";
    if (res.status === 429)
      throw new AiError("Limite gratuite de Gemini atteinte. Attends une minute puis réessaie.", 429);
    if (res.status === 404)
      throw new AiError(
        `Le modèle Gemini « ${model} » n'existe pas. Mets un nom de modèle valide dans GEMINI_MODEL (voir la liste sur ai.google.dev).`,
        400,
      );
    if (res.status === 400 && /api key/i.test(msg))
      throw new AiError("Clé Gemini invalide. Vérifie GEMINI_API_KEY.", 401);
    if (res.status === 403) throw new AiError("Clé Gemini refusée (403). Vérifie GEMINI_API_KEY.", 401);
    throw new AiError(`Erreur Gemini (${res.status}) : ${msg.slice(0, 300)}`, 502);
  }

  const candidate = data?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) {
    const reason = candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "inconnue";
    throw new AiError(`Gemini n'a renvoyé aucun texte (raison : ${reason}). Réessaie.`, 502);
  }
  const searches = candidate?.groundingMetadata?.webSearchQueries?.length ?? 0;
  return {
    text,
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0),
      searches,
    },
  };
}
