// Étape 3 : rédiger les fiches Vinted des produits retenus.
import { z } from "zod";
import { generateJson } from "@/lib/ai";
import { SYSTEM_FR, listingsPrompt } from "@/lib/prompts";
import { errorResponse } from "@/lib/http";
import type { Listing, SupplierProduct } from "@/lib/types";

export const maxDuration = 90;

const schema = z.object({
  niche: z.string().trim().min(2).max(120),
  items: z
    .array(
      z.object({
        prixVente: z.number().positive(),
        product: z.object({
          title: z.string().min(1).max(300),
          attributes: z.record(z.string(), z.string()).optional(),
        }),
      }),
    )
    .min(1)
    .max(6),
});

const txt = z.union([z.string(), z.number()]).transform(String).optional();
const answerSchema = z.object({
  fiches: z.array(
    z.object({
      index: z.coerce.number().int(),
      titre: txt,
      description: txt,
      categorie: txt,
      marque: txt,
      taille: txt,
      etat: txt,
      couleur: txt,
      matiere: txt,
      motsCles: z.union([z.array(z.string()), z.string()]).optional(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { data, usage } = await generateJson(
      {
        prompt: listingsPrompt(
          body.niche,
          body.items.map((it) => ({ prixVente: it.prixVente, product: it.product as SupplierProduct })),
        ),
        system: SYSTEM_FR,
      },
      (d) => answerSchema.parse(d),
    );
    const listings: (Listing | null)[] = body.items.map((_, i) => {
      const f = data.fiches.find((x) => x.index === i) ?? data.fiches[i];
      if (!f || !f.titre) return null;
      const mots = Array.isArray(f.motsCles) ? f.motsCles : (f.motsCles ?? "").split(/[,;]\s*/);
      return {
        titre: f.titre.slice(0, 80),
        description: f.description ?? "",
        categorie: f.categorie ?? "À préciser",
        marque: f.marque || "Sans marque",
        taille: f.taille || "À préciser",
        etat: f.etat || "Neuf sans étiquette",
        couleur: f.couleur || "À préciser",
        matiere: f.matiere || "À préciser",
        motsCles: mots.map((m) => m.trim()).filter(Boolean),
      };
    });
    return Response.json({ listings, usage });
  } catch (e) {
    return errorResponse(e);
  }
}
