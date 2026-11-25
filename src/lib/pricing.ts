// Toute la logique de prix est ici, dans le code (jamais décidée par l'IA).
import type { Evaluation, MarketEstimate, Mode, SupplierProduct } from "./types";

export const DEFAULT_COEFFICIENT = 2.5;
export const MARKET_TOLERANCE = 1.1; // +10 % au-dessus de la médiane du marché
export const DROPSHIP_MAX_DAYS = 5;
export const MAX_RESULTS = 4;

const EPS = 1e-9;

const fr = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

/** Coefficient valide (≥ 1), sinon le coefficient par défaut. */
export function normalizeCoefficient(value: unknown): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_COEFFICIENT;
  return n;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Prix de vente = (achat + livraison) × coefficient, arrondi à l'euro supérieur. */
export function computeSellingPrice(coutTotal: number, coefficient: number): number {
  return Math.ceil(coutTotal * coefficient - EPS);
}

export function median(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Transforme une liste de prix Vinted réels en estimation de marché (remplace l'IA). */
export function marketFromRealPrices(prices: number[]): MarketEstimate | null {
  const v = prices.filter((x) => Number.isFinite(x) && x > 0);
  if (v.length === 0) return null;
  return {
    min: Math.min(...v),
    median: round2(median(v)),
    max: Math.max(...v),
    confiance: v.length >= 3 ? "haute" : "moyenne",
    justification: `Médiane de ${v.length} annonce(s) Vinted réelle(s) saisie(s).`,
    source: "reel",
    realPrices: v,
  };
}

/** Lit une liste de prix tapée librement : "12, 15 18,5 ; 20€" → [12, 15, 18.5, 20] */
export function parsePriceList(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((s) => Number(s.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function evaluateProduct(
  product: SupplierProduct,
  opts: { coefficient: number; mode: Mode; market: MarketEstimate | null },
): Evaluation {
  const coefficient = normalizeCoefficient(opts.coefficient);
  const coutTotal = round2((product.priceEUR || 0) + (product.shippingEUR || 0));
  const prixVente = computeSellingPrice(coutTotal, coefficient);
  const margeEUR = round2(prixVente - coutTotal);
  const base = { product, coutTotal, prixVente, margeEUR, market: opts.market };

  if (!Number.isFinite(product.priceEUR) || product.priceEUR <= 0) {
    return { ...base, status: "ecarte", raison: "Données fournisseur incomplètes (pas de prix d'achat)." };
  }
  if (
    opts.mode === "dropship" &&
    (product.deliveryDaysMax === null || product.deliveryDaysMax > DROPSHIP_MAX_DAYS)
  ) {
    return {
      ...base,
      status: "ecarte",
      raison:
        product.deliveryDaysMax === null
          ? "Délai de livraison inconnu : trop risqué en dropshipping (Vinted laisse 5 jours ouvrés pour expédier)."
          : `Livraison trop lente (${product.deliveryDaysMax} j) : Vinted laisse 5 jours ouvrés pour expédier.`,
    };
  }
  if (!opts.market || !Number.isFinite(opts.market.median) || opts.market.median <= 0) {
    return { ...base, status: "ecarte", raison: "Prix du marché Vinted impossible à estimer." };
  }
  const plafond = opts.market.median * MARKET_TOLERANCE;
  if (prixVente > plafond + EPS) {
    return {
      ...base,
      status: "ecarte",
      raison: `Trop cher pour le marché : ${fr(prixVente)} alors que le plafond est ${fr(round2(plafond))} (médiane ${fr(opts.market.median)} + 10 %).`,
    };
  }
  return { ...base, status: "retenu" };
}

const CONF_RANK = { haute: 3, moyenne: 2, faible: 1 } as const;

/** Classe les produits retenus : marge € décroissante, puis confiance de l'estimation. */
export function rankRetained(evals: Evaluation[], limit = MAX_RESULTS): Evaluation[] {
  return evals
    .filter((e) => e.status === "retenu")
    .sort(
      (a, b) =>
        b.margeEUR - a.margeEUR ||
        (b.market ? CONF_RANK[b.market.confiance] : 0) - (a.market ? CONF_RANK[a.market.confiance] : 0),
    )
    .slice(0, limit);
}
