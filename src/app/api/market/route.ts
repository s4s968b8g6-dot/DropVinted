// Étape 2 : estimer le prix du marché Vinted pour chaque produit (recherche web de l'IA).
import { z } from "zod";
import { generateJson } from "@/lib/ai";
import { SYSTEM_FR, marketPrompt } from "@/lib/prompts";
import { errorResponse } from "@/lib/http";
import { toNumber } from "@/lib/json";
import type { MarketEstimate } from "@/lib/types";

export const maxDuration = 90;

const schema = z.object({
  niche: z.string().trim().min(2).max(120),
  products: z
    .array(z.object({ title: z.string().min(1).max(300), attributes: z.record(z.string(), z.string()).optional() }))
    .min(1)
    .max(10),
});

const answerSchema = z.object({
  estimations: z.array(
    z.object({
      index: z.coerce.number().int(),
      min: z.union([z.number(), z.string()]),
      median: z.union([z.number(), z.string()]),
      max: z.union([z.number(), z.string()]),
      confiance: z.string().optional(),
      justification: z.string().optional(),
    }),
  ),
});

function toConfiance(v?: string): MarketEstimate["confiance"] {
  const s = (v ?? "").toLowerCase();
  if (s.startsWith("haut")) return "haute";
  if (s.startsWith("moy")) return "moyenne";
  return "faible";
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { data, usage } = await generateJson(
      { prompt: marketPrompt(body.niche, body.products), system: SYSTEM_FR, search: true },
      (d) => answerSchema.parse(d),
    );
    const estimates: (MarketEstimate | null)[] = body.products.map((_, i) => {
      const e = data.estimations.find((x) => x.index === i);
      if (!e) return null;
      const median = toNumber(e.median);
      if (!Number.isFinite(median) || median <= 0) return null;
      const min = toNumber(e.min, "min");
      const max = toNumber(e.max);
      return {
        min: Number.isFinite(min) ? Math.min(min, median) : median,
        median,
        max: Number.isFinite(max) ? Math.max(max, median) : median,
        confiance: toConfiance(e.confiance),
        justification: e.justification ?? "",
        source: "ia",
      };
    });
    return Response.json({ estimates, usage });
  } catch (e) {
    return errorResponse(e);
  }
}
