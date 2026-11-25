// Étape 1 : trouver des produits fournisseurs pour la niche.
import { z } from "zod";
import { searchProducts } from "@/lib/sources";
import { errorResponse } from "@/lib/http";

export const maxDuration = 60;

const schema = z.object({
  niche: z.string().trim().min(2).max(120),
  mode: z.enum(["stock", "dropship"]),
  source: z.enum(["cj", "ai_web", "manual", "aliexpress"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await searchProducts({ ...body, limit: 8 });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
