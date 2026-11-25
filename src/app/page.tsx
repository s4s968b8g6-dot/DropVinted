"use client";

import { useEffect, useState } from "react";
import type { Evaluation, Listing, MarketEstimate, Mode, RunResult, SourceId, SupplierProduct, Usage } from "@/lib/types";
import { DEFAULT_COEFFICIENT, MAX_RESULTS, evaluateProduct, marketFromRealPrices, normalizeCoefficient, parsePriceList, rankRetained } from "@/lib/pricing";
import { addUsage, api, saveRun } from "@/lib/client";
import { Results } from "@/components/Results";

interface Config {
  ai: "gemini" | "anthropic" | null;
  sources: { id: SourceId; label: string; available: boolean }[];
  defaultSource: SourceId;
}

interface ManualRow {
  title: string;
  url: string;
  price: string;
  shipping: string;
  days: string;
}

const emptyRow = (): ManualRow => ({ title: "", url: "", price: "", shipping: "", days: "" });

const STEPS = ["Recherche des produits", "Estimation du marché Vinted", "Filtrage marge et prix", "Rédaction des fiches"];

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [niche, setNiche] = useState("");
  const [coef, setCoef] = useState(String(DEFAULT_COEFFICIENT).replace(".", ","));
  const [mode, setMode] = useState<Mode>("stock");
  const [source, setSource] = useState<SourceId>("manual");
  const [realText, setRealText] = useState("");
  const [rows, setRows] = useState<ManualRow[]>([emptyRow()]);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState("");
  const [run, setRun] = useState<RunResult | null>(null);

  useEffect(() => {
    api<Config>("/api/config")
      .then((c) => {
        setConfig(c);
        setSource(c.defaultSource);
      })
      .catch((e) => setError(e.message));
  }, []);

  const busy = step >= 0;

  async function launch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRun(null);
    const coefficient = normalizeCoefficient(coef);
    const realPrices = parsePriceList(realText);
    let usage: Usage = { inputTokens: 0, outputTokens: 0, searches: 0 };

    try {
      // 1. Produits fournisseurs
      setStep(0);
      let products: SupplierProduct[];
      if (source === "manual") {
        products = rows
          .filter((r) => r.title.trim() && r.price.trim())
          .map((r) => ({
            source: "manual" as const,
            title: r.title.trim(),
            url: r.url.trim() || "#",
            priceEUR: Number(r.price.replace(",", ".")),
            shippingEUR: Number(r.shipping.replace(",", ".")) || 0,
            deliveryDaysMax: r.days.trim() ? Number(r.days) : null,
            dataConfidence: "manual" as const,
          }));
        if (products.length === 0) throw new Error("Ajoute au moins un produit avec un nom et un prix d'achat.");
      } else {
        const r = await api<{ products: SupplierProduct[]; usage: Usage }>("/api/search", { niche, mode, source });
        products = r.products;
        usage = addUsage(usage, r.usage);
      }

      // 2. Prix du marché Vinted (prix réels saisis > estimation IA)
      setStep(1);
      let markets: (MarketEstimate | null)[];
      const real = marketFromRealPrices(realPrices);
      if (real) {
        markets = products.map(() => real);
      } else {
        if (!config?.ai) throw new Error("Sans clé IA, colle des prix Vinted réels dans le champ prévu pour estimer le marché.");
        const r = await api<{ estimates: (MarketEstimate | null)[]; usage: Usage }>("/api/market", {
          niche,
          products: products.map((p) => ({ title: p.title, attributes: p.attributes })),
        });
        markets = r.estimates;
        usage = addUsage(usage, r.usage);
      }

      // 3. Filtrage (dans le code, règles fixes)
      setStep(2);
      const evaluations = products.map((p, i) => evaluateProduct(p, { coefficient, mode, market: markets[i] ?? null }));
      const kept = rankRetained(evaluations, MAX_RESULTS);
      const rejected: Evaluation[] = evaluations
        .filter((ev) => !kept.includes(ev))
        .map((ev) => (ev.status === "retenu" ? { ...ev, status: "ecarte" as const, raison: `Moins rentable que les ${MAX_RESULTS} meilleurs.` } : ev));

      // 4. Fiches
      setStep(3);
      let listings: (Listing | null)[] = kept.map(() => null);
      if (kept.length > 0 && config?.ai) {
        const r = await api<{ listings: (Listing | null)[]; usage: Usage }>("/api/listings", {
          niche,
          items: kept.map((k) => ({ prixVente: k.prixVente, product: { title: k.product.title, attributes: k.product.attributes } })),
        });
        listings = r.listings;
        usage = addUsage(usage, r.usage);
      }

      const result: RunResult = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        params: { niche, coefficient, mode, source, realPrices },
        items: kept.map((evaluation, i) => ({ evaluation, listing: listings[i] ?? null })),
        rejected,
        usage,
      };
      saveRun(result);
      setRun(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setStep(-1);
    }
  }

  const updateRow = (i: number, key: keyof ManualRow, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 focus:border-emerald-600 focus:outline-none";

  return (
    <div className="space-y-6">
      <form onSubmit={launch} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Trouve des produits et génère tes fiches Vinted</h1>
          <p className="text-sm text-stone-500">Niche → produits fournisseurs → marge et prix du marché → fiches prêtes à copier.</p>
        </div>

        {config && !config.ai && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Aucune clé IA configurée : ajoute <code>GEMINI_API_KEY</code> dans Vercel pour l&apos;estimation du marché et la rédaction des fiches.
          </div>
        )}

        <label className="block text-sm font-medium text-stone-700">
          Ta niche
          <input required minLength={2} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ex. casquettes vintage, vêtements gothiques" className={input} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-stone-700">
            Coefficient
            <input value={coef} onChange={(e) => setCoef(e.target.value)} inputMode="decimal" className={input} />
            <span className="text-xs font-normal text-stone-500">Prix = (achat + livraison) × coef.</span>
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Mode
            <span className="sr-only">Stock = tu achètes avant de vendre. Dropship = produit livré en 5 jours max.</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={input}>
              <option value="stock">Stock</option>
              <option value="dropship">Dropship ≤ 5 j</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Source des produits
          <select value={source} onChange={(e) => setSource(e.target.value as SourceId)} className={input}>
            {(config?.sources ?? [{ id: "manual" as SourceId, label: "Saisie manuelle", available: true }]).map((s) => (
              <option key={s.id} value={s.id} disabled={!s.available}>
                {s.label}
                {!s.available ? " — non configurée" : ""}
              </option>
            ))}
          </select>
        </label>

        {source === "manual" && (
          <div className="space-y-3 rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-600">Colle tes produits (prix en euros, délai en jours).</p>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <input placeholder="Nom du produit" value={r.title} onChange={(e) => updateRow(i, "title", e.target.value)} className={`${input} col-span-2 mt-0`} />
                <input placeholder="Lien" value={r.url} onChange={(e) => updateRow(i, "url", e.target.value)} className={`${input} col-span-2 mt-0`} />
                <input placeholder="Prix €" inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, "price", e.target.value)} className={`${input} mt-0`} />
                <div className="flex gap-2">
                  <input placeholder="Livr. €" inputMode="decimal" value={r.shipping} onChange={(e) => updateRow(i, "shipping", e.target.value)} className={`${input} mt-0`} />
                  <input placeholder="Jours" inputMode="numeric" value={r.days} onChange={(e) => updateRow(i, "days", e.target.value)} className={`${input} mt-0`} />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm">
                + Ajouter un produit
              </button>
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((rs) => rs.slice(0, -1))} className="rounded-lg px-3 py-1.5 text-sm text-stone-500">
                  Retirer le dernier
                </button>
              )}
            </div>
          </div>
        )}

        <label className="block text-sm font-medium text-stone-700">
          Prix Vinted réels comparables <span className="font-normal text-stone-500">(optionnel)</span>
          <input value={realText} onChange={(e) => setRealText(e.target.value)} placeholder="ex. 12, 15, 18, 14" className={input} />
          <span className="text-xs font-normal text-stone-500">Si tu en mets, ils remplacent l&apos;estimation de l&apos;IA (plus fiable).</span>
        </label>

        <button disabled={busy} className="w-full rounded-xl bg-emerald-700 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
          {busy ? "En cours…" : "Lancer la recherche"}
        </button>

        {busy && (
          <ol className="space-y-1 text-sm">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "text-emerald-700" : i === step ? "font-semibold text-stone-900" : "text-stone-400"}>
                {i < step ? "✓" : i === step ? "⏳" : "○"} {s}
              </li>
            ))}
          </ol>
        )}

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      </form>

      {run && <Results run={run} />}
    </div>
  );
}
