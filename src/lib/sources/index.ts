// Sources fournisseurs interchangeables : on ajoute une source sans toucher au reste de l'app.
import "server-only";
import { z } from "zod";
import type { Mode, SourceId, SupplierProduct, Usage } from "../types";
import { generateJson, getAiProvider } from "../ai";
import { SYSTEM_FR, aiWebSearchPrompt, keywordsPrompt } from "../prompts";
import { toNumber } from "../json";
import { searchCj } from "./cj";
import { SourceError } from "./errors";

export { SourceError } from "./errors";

export const SOURCE_LABELS: Record<SourceId, string> = {
  cj: "CJ Dropshipping (API)",
  ai_web: "Recherche IA sur AliExpress",
  manual: "Saisie manuelle",
  aliexpress: "API AliExpress (bientôt)",
};

export function availableSources(): { id: SourceId; label: string; available: boolean }[] {
  const ai = getAiProvider() !== null;
  return [
    { id: "cj", label: SOURCE_LABELS.cj, available: Boolean(process.env.CJ_API_KEY || process.env.CJ_ACCESS_TOKEN) },
    { id: "ai_web", label: SOURCE_LABELS.ai_web, available: ai },
    { id: "manual", label: SOURCE_LABELS.manual, available: true },
    {
      id: "aliexpress",
      label: SOURCE_LABELS.aliexpress,
      available: false, // squelette prêt, à brancher quand tu auras l'API AliExpress
    },
  ];
}

export function defaultSource(): SourceId {
  const wanted = (process.env.SOURCE_PROVIDER || "").toLowerCase();
  const map: Record<string, SourceId> = { cj: "cj", claude_web: "ai_web", ai_web: "ai_web", manual: "manual", aliexpress: "aliexpress" };
  const list = availableSources();
  const pick = map[wanted];
  if (pick && list.find((s) => s.id === pick)?.available) return pick;
  return list.find((s) => s.available)?.id ?? "manual";
}

const zero = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0 });

const keywordsSchema = z.object({ keywords: z.array(z.string().min(1)).min(1) });

const aiProductsSchema = z.object({
  products: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().url(),
      imageUrl: z.string().nullish(),
      priceEUR: z.union([z.number(), z.string()]).nullish(),
      shippingEUR: z.union([z.number(), z.string()]).nullish(),
      deliveryDaysMax: z.union([z.number(), z.string()]).nullish(),
      warehouse: z.string().nullish(),
      attributes: z.record(z.string(), z.unknown()).nullish(),
    }),
  ),
});

export async function searchProducts(params: {
  source: SourceId;
  niche: string;
  mode: Mode;
  limit: number;
}): Promise<{ products: SupplierProduct[]; usage: Usage; keywords?: string[] }> {
  const { source, niche, mode, limit } = params;

  if (source === "aliexpress") {
    throw new SourceError("L'API AliExpress n'est pas encore branchée. Utilise CJ ou la recherche IA en attendant.", 400);
  }
  if (source === "manual") {
    throw new SourceError("La saisie manuelle se fait directement dans le formulaire.", 400);
  }

  if (source === "cj") {
    // On traduit la niche en mots-clés anglais (CJ est en anglais). Si l'IA échoue, on garde la niche telle quelle.
    let keywords = [niche];
    let usage = zero();
    if (getAiProvider()) {
      try {
        const r = await generateJson({ prompt: keywordsPrompt(niche), system: SYSTEM_FR }, (d) => keywordsSchema.parse(d));
        keywords = [...r.data.keywords.slice(0, 3), niche];
        usage = r.usage;
      } catch {
        // pas grave, on cherche avec la niche brute
      }
    }
    const products = await searchCj({ keywords, mode, limit });
    if (products.length === 0) {
      throw new SourceError(
        mode === "dropship"
          ? "Aucun produit CJ en stock en France pour cette niche. Essaie le mode Stock ou une niche plus large."
          : "Aucun produit CJ trouvé pour cette niche. Essaie des mots plus simples.",
        404,
      );
    }
    return { products, usage, keywords };
  }

  // Recherche IA sur le web (AliExpress)
  const { data, usage } = await generateJson(
    { prompt: aiWebSearchPrompt(niche, mode, limit), system: SYSTEM_FR, search: true },
    (d) => aiProductsSchema.parse(d),
  );
  const products: SupplierProduct[] = data.products.slice(0, limit).map((p) => {
    const days = toNumber(p.deliveryDaysMax ?? "", "max");
    return {
      source: "aliexpress",
      title: p.title,
      url: p.url,
      imageUrl: p.imageUrl ?? undefined,
      priceEUR: toNumber(p.priceEUR ?? "", "max"),
      shippingEUR: Number.isFinite(toNumber(p.shippingEUR ?? "")) ? toNumber(p.shippingEUR ?? "") : 0,
      deliveryDaysMax: Number.isFinite(days) ? days : null,
      warehouse: p.warehouse ?? undefined,
      attributes: p.attributes
        ? Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, String(v)]))
        : undefined,
      dataConfidence: "web_estimate",
    };
  });
  if (products.length === 0) throw new SourceError("L'IA n'a trouvé aucun produit. Reformule la niche.", 404);
  return { products, usage };
}
