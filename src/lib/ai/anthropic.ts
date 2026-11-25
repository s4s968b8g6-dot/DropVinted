// Option pour plus tard : repasser sur Claude en mettant AI_PROVIDER=anthropic et ANTHROPIC_API_KEY.
import "server-only";
import { AiError, type AiRequest, type AiResponse } from "./core";

const DEFAULT_MODEL = "claude-sonnet-5-5";

export async function anthropicGenerate(req: AiRequest): Promise<AiResponse> {
  const body: Record<string, unknown> = {
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: req.prompt }],
  };
  if (req.system) body.system = req.system;
  if (req.search) {
    // Vérifier dans la doc Anthropic le nom à jour de l'outil web search si une erreur apparaît.
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: req.maxSearches ?? 5 }];
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    console.error("Anthropic fetch", e);
    throw new AiError("Claude ne répond pas (délai dépassé ou réseau). Réessaie.", 504);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message ?? "";
    if (res.status === 401) throw new AiError("Clé Anthropic invalide. Vérifie ANTHROPIC_API_KEY.", 401);
    if (res.status === 429) throw new AiError("Limite Anthropic atteinte. Attends un peu puis réessaie.", 429);
    throw new AiError(`Erreur Claude (${res.status}) : ${msg.slice(0, 300)}`, 502);
  }
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return {
    text,
    usage: {
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0,
      searches: data?.usage?.server_tool_use?.web_search_requests ?? 0,
    },
  };
}
