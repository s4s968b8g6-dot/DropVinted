"use client";

import { useMemo, useState } from "react";
import type { Mode, ResultItem } from "@/lib/types";
import { evaluateProduct, marketFromRealPrices, parsePriceList } from "@/lib/pricing";
import { euro } from "@/lib/client";
import { CopyButton, CopyField } from "./CopyButton";

function fullText(item: ResultItem, prix: number): string {
  const l = item.listing;
  if (!l) return "";
  return [
    `Titre : ${l.titre}`,
    ``,
    l.description,
    ``,
    `Catégorie : ${l.categorie}`,
    `Marque : ${l.marque}`,
    `Taille : ${l.taille}`,
    `État : ${l.etat}`,
    `Couleur : ${l.couleur}`,
    `Matière : ${l.matiere}`,
    `Prix : ${prix} €`,
  ].join("\n");
}

export function ResultCard({ item, coefficient, mode }: { item: ResultItem; coefficient: number; mode: Mode }) {
  const [realText, setRealText] = useState("");
  const { product } = item.evaluation;

  // Si tu colles des prix Vinted réels, on recalcule tout de suite avec ces prix.
  const evaluation = useMemo(() => {
    const real = marketFromRealPrices(parsePriceList(realText));
    if (!real) return item.evaluation;
    return evaluateProduct(product, { coefficient, mode, market: real });
  }, [realText, item.evaluation, product, coefficient, mode]);

  const m = evaluation.market;
  const l = item.listing;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex gap-3 border-b border-stone-100 p-4">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            className="h-20 w-20 shrink-0 rounded-lg object-cover bg-stone-100" />
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-lg bg-stone-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs text-stone-500">{product.title}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-bold text-stone-900">{euro(evaluation.prixVente)}</span>
            <span className="text-sm font-semibold text-emerald-700">+{euro(evaluation.margeEUR)} de marge</span>
          </div>
          <a href={product.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-emerald-700 underline">
            Voir chez le fournisseur ↗
          </a>
          {product.sku && <span className="ml-2 text-xs text-stone-400">SKU {product.sku}</span>}
        </div>
      </div>

      {evaluation.status === "ecarte" && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-800">
          ⚠️ Avec tes prix réels, ce produit ne passe plus : {evaluation.raison}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-stone-50 px-4 py-3 text-xs text-stone-600 sm:grid-cols-4">
        <div>Achat : <b className="text-stone-900">{euro(product.priceEUR)}</b></div>
        <div>
          Livraison : <b className="text-stone-900">{euro(product.shippingEUR)}</b>
          {product.shippingEstimated && <span className="text-stone-400"> (estim.)</span>}
        </div>
        <div>Coût total : <b className="text-stone-900">{euro(evaluation.coutTotal)}</b></div>
        <div>Délai : <b className="text-stone-900">{product.deliveryDaysMax ? `${product.deliveryDaysMax} j` : "inconnu"}</b></div>
        {m && (
          <div className="col-span-2 sm:col-span-4">
            Marché Vinted : <b className="text-stone-900">{euro(m.min)} – {euro(m.max)}</b> (médiane {euro(m.median)}){" "}
            {m.source === "ia" ? (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Estimation IA – à vérifier</span>
            ) : (
              <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">Prix réels</span>
            )}
            {m.justification && <div className="mt-0.5 text-stone-500">{m.justification}</div>}
          </div>
        )}
        {product.dataConfidence === "web_estimate" && (
          <div className="col-span-2 text-amber-700 sm:col-span-4">Prix fournisseur trouvé par l&apos;IA : vérifie-le sur le lien avant d&apos;acheter.</div>
        )}
      </div>

      <div className="px-4 py-2">
        {l ? (
          <>
            <CopyField label="Titre" value={l.titre} />
            <CopyField label="Description" value={l.description} multiline />
            <CopyField label="Catégorie" value={l.categorie} />
            <div className="grid sm:grid-cols-2 sm:gap-x-4">
              <CopyField label="Marque" value={l.marque} />
              <CopyField label="Taille" value={l.taille} />
              <CopyField label="État" value={l.etat} />
              <CopyField label="Couleur" value={l.couleur} />
              <CopyField label="Matière" value={l.matiere} />
              <CopyField label="Prix" value={String(evaluation.prixVente)} />
            </div>
            {l.motsCles.length > 0 && <CopyField label="Mots-clés" value={l.motsCles.join(", ")} />}
          </>
        ) : (
          <p className="py-3 text-sm text-stone-500">La fiche n&apos;a pas pu être rédigée pour ce produit.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50 p-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-stone-600">
          Prix Vinted réels vus pour un article similaire (optionnel)
          <input
            value={realText}
            onChange={(e) => setRealText(e.target.value)}
            placeholder="ex. 12, 15, 18"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
        </label>
        {l && <CopyButton text={fullText(item, evaluation.prixVente)} label="Tout copier" className="px-4 py-2 text-sm" />}
      </div>
    </article>
  );
}
