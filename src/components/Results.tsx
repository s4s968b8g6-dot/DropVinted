"use client";

import type { RunResult } from "@/lib/types";
import { euro } from "@/lib/client";
import { ResultCard } from "./ResultCard";

export function Results({ run }: { run: RunResult }) {
  const { params } = run;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-stone-900">
          {run.items.length} fiche{run.items.length > 1 ? "s" : ""} prête{run.items.length > 1 ? "s" : ""} · « {params.niche} »
        </h2>
        <span className="text-xs text-stone-500">
          ×{params.coefficient} · {params.mode === "dropship" ? "Dropshipping ≤ 5 j" : "Stock"} ·{" "}
          {new Date(run.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>

      {run.items.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Aucun produit ne respecte tes règles (marge, prix du marché, délai). Essaie un coefficient plus bas, le mode Stock, ou une autre niche.
        </div>
      )}

      {run.items.map((item, i) => (
        <ResultCard key={`${run.id}-${i}`} item={item} coefficient={params.coefficient} mode={params.mode} />
      ))}

      {run.rejected.length > 0 && (
        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">
            Produits écartés ({run.rejected.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {run.rejected.map((e, i) => (
              <li key={i} className="text-sm">
                <a href={e.product.url} target="_blank" rel="noreferrer" className="font-medium text-stone-800 underline">
                  {e.product.title.slice(0, 80)}
                </a>
                <span className="text-stone-500"> · coût {euro(e.coutTotal)} → {euro(e.prixVente)}</span>
                <div className="text-red-700">{e.raison}</div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-center text-xs text-stone-400">
        IA : {run.usage.inputTokens + run.usage.outputTokens} tokens · {run.usage.searches} recherche(s) web
      </p>
    </section>
  );
}
