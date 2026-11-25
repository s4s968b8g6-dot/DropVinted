"use client";

import { useEffect, useState } from "react";
import type { RunResult } from "@/lib/types";
import { deleteRun, loadHistory } from "@/lib/client";
import { Results } from "@/components/Results";

export default function HistoryPage() {
  const [list, setList] = useState<RunResult[] | null>(null);
  const [open, setOpen] = useState<RunResult | null>(null);

  useEffect(() => {
    // lecture du stockage local après l'affichage (le serveur n'y a pas accès)
    const t = setTimeout(() => setList(loadHistory()), 0);
    return () => clearTimeout(t);
  }, []);

  if (open) {
    return (
      <div className="space-y-4">
        <button onClick={() => setOpen(null)} className="text-sm font-medium text-emerald-700">← Retour à l&apos;historique</button>
        <Results run={open} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Historique</h1>
      <p className="text-sm text-stone-500">Tes 30 dernières recherches, enregistrées sur cet appareil uniquement.</p>
      {list && list.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-stone-500">Aucune recherche pour l&apos;instant.</p>}
      <ul className="space-y-2">
        {list?.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <button onClick={() => setOpen(r)} className="min-w-0 flex-1 text-left">
              <div className="truncate font-semibold">« {r.params.niche} »</div>
              <div className="text-xs text-stone-500">
                {new Date(r.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {r.items.length} fiche(s) · ×{r.params.coefficient}
              </div>
            </button>
            <button
              onClick={() => {
                deleteRun(r.id);
                setList(loadHistory());
              }}
              className="text-xs text-stone-400 hover:text-red-600"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
