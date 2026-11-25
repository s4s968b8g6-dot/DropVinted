import "server-only";
import { AiError } from "./ai";
import { SourceError } from "./sources/errors";

/** Transforme n'importe quelle erreur en réponse JSON claire pour l'interface. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AiError || e instanceof SourceError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  if (e && typeof e === "object" && "issues" in e) {
    return Response.json({ error: "Données envoyées invalides." }, { status: 400 });
  }
  console.error(e);
  return Response.json({ error: "Erreur inattendue côté serveur. Réessaie." }, { status: 500 });
}
