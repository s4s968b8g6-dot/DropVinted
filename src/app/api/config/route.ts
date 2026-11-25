// Indique à l'interface ce qui est configuré (sans jamais renvoyer les clés).
import { getAiProvider } from "@/lib/ai";
import { availableSources, defaultSource } from "@/lib/sources";

export async function POST() {
  return Response.json({
    ai: getAiProvider(),
    sources: availableSources(),
    defaultSource: defaultSource(),
  });
}
