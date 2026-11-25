import { describe, expect, it } from "vitest";
import {
  DEFAULT_COEFFICIENT,
  computeSellingPrice,
  evaluateProduct,
  marketFromRealPrices,
  normalizeCoefficient,
  parsePriceList,
  rankRetained,
} from "./pricing";
import type { MarketEstimate, SupplierProduct } from "./types";

const product = (over: Partial<SupplierProduct> = {}): SupplierProduct => ({
  source: "cj",
  title: "Casquette",
  url: "https://example.com",
  priceEUR: 4,
  shippingEUR: 2,
  deliveryDaysMax: 4,
  dataConfidence: "api",
  ...over,
});

const market = (medianValue: number): MarketEstimate => ({
  min: medianValue - 2,
  median: medianValue,
  max: medianValue + 2,
  confiance: "moyenne",
  justification: "test",
  source: "ia",
});

describe("arrondi et coefficient", () => {
  it("arrondit à l'euro supérieur", () => {
    expect(computeSellingPrice(6, 2.5)).toBe(15);
    expect(computeSellingPrice(6.1, 2.5)).toBe(16); // 15.25 -> 16
    expect(computeSellingPrice(0.1 + 0.2, 10)).toBe(3); // pas d'erreur de flottant
  });
  it("utilise 2,5 par défaut si le coefficient est absent ou invalide", () => {
    expect(DEFAULT_COEFFICIENT).toBe(2.5);
    expect(normalizeCoefficient(undefined)).toBe(2.5);
    expect(normalizeCoefficient("abc")).toBe(2.5);
    expect(normalizeCoefficient(0.5)).toBe(2.5);
    expect(normalizeCoefficient("3,2")).toBe(3.2);
  });
  it("calcule coût total, prix et marge", () => {
    const e = evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: market(20) });
    expect(e.coutTotal).toBe(6);
    expect(e.prixVente).toBe(15);
    expect(e.margeEUR).toBe(9);
    expect(e.status).toBe("retenu");
  });
});

describe("seuil +10 % au-dessus du marché", () => {
  // prix de vente = 15 €
  it("garde le produit juste en dessous / pile au seuil", () => {
    // médiane 13.64 -> plafond 15.004
    expect(evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: market(13.64) }).status).toBe("retenu");
    // pile au seuil : 15 = 13.6363... * 1.1
    expect(evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: market(15 / 1.1) }).status).toBe("retenu");
  });
  it("écarte le produit juste au-dessus", () => {
    const e = evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: market(13.6) });
    expect(e.status).toBe("ecarte");
    expect(e.raison).toMatch(/Trop cher/);
  });
  it("écarte si le marché est inconnu", () => {
    expect(evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: null }).status).toBe("ecarte");
  });
});

describe("filtre délai en dropshipping", () => {
  it("garde ≤ 5 jours", () => {
    expect(
      evaluateProduct(product({ deliveryDaysMax: 5 }), { coefficient: 2.5, mode: "dropship", market: market(20) }).status,
    ).toBe("retenu");
  });
  it("écarte > 5 jours ou délai inconnu", () => {
    expect(
      evaluateProduct(product({ deliveryDaysMax: 6 }), { coefficient: 2.5, mode: "dropship", market: market(20) }).status,
    ).toBe("ecarte");
    expect(
      evaluateProduct(product({ deliveryDaysMax: null }), { coefficient: 2.5, mode: "dropship", market: market(20) })
        .status,
    ).toBe("ecarte");
  });
  it("n'applique pas le filtre délai en mode stock", () => {
    expect(
      evaluateProduct(product({ deliveryDaysMax: 20 }), { coefficient: 2.5, mode: "stock", market: market(20) }).status,
    ).toBe("retenu");
  });
});

describe("prix réels Vinted", () => {
  it("calcule la médiane et remplace l'estimation IA", () => {
    const m = marketFromRealPrices([10, 30, 12, 14]);
    expect(m?.median).toBe(13);
    expect(m?.source).toBe("reel");
    // avec l'estimation IA (20) le produit passait ; avec les prix réels (13 -> plafond 14.3) il est écarté
    expect(evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: market(20) }).status).toBe("retenu");
    expect(evaluateProduct(product(), { coefficient: 2.5, mode: "stock", market: m }).status).toBe("ecarte");
  });
  it("lit une liste de prix tapée librement", () => {
    expect(parsePriceList("12, 15 18,5 ; 20€")).toEqual([12, 15, 18.5, 20]);
    expect(marketFromRealPrices([])).toBeNull();
  });
});

describe("données incomplètes et classement", () => {
  it("écarte sans prix d'achat", () => {
    expect(evaluateProduct(product({ priceEUR: 0 }), { coefficient: 2.5, mode: "stock", market: market(20) }).status).toBe(
      "ecarte",
    );
  });
  it("classe par marge décroissante et garde 4 max", () => {
    const evals = [3, 8, 5, 1, 6].map((p) =>
      evaluateProduct(product({ priceEUR: p, title: String(p) }), { coefficient: 2, mode: "stock", market: market(100) }),
    );
    const ranked = rankRetained(evals);
    expect(ranked).toHaveLength(4);
    expect(ranked.map((e) => e.product.title)).toEqual(["8", "6", "5", "3"]);
  });
});
