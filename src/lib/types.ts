// Types partagés entre le serveur et l'interface.

export type SourceId = "cj" | "ai_web" | "manual" | "aliexpress";
export type Mode = "stock" | "dropship";

export interface SupplierProduct {
  source: "aliexpress" | "cj" | "manual" | "other";
  title: string;
  url: string;
  imageUrl?: string;
  sku?: string;
  priceEUR: number; // prix d'achat unitaire
  shippingEUR: number; // livraison fournisseur vers la France
  shippingEstimated?: boolean; // true si la livraison est une estimation
  deliveryDaysMax: number | null; // délai de livraison max annoncé
  warehouse?: string; // ex. "CN", "FR"
  attributes?: Record<string, string>;
  dataConfidence: "api" | "web_estimate" | "manual";
}

export type Confiance = "faible" | "moyenne" | "haute";

export interface MarketEstimate {
  min: number;
  median: number;
  max: number;
  confiance: Confiance;
  justification: string;
  source: "ia" | "reel";
  realPrices?: number[];
}

export interface Evaluation {
  product: SupplierProduct;
  coutTotal: number;
  prixVente: number;
  margeEUR: number;
  market: MarketEstimate | null;
  status: "retenu" | "ecarte";
  raison?: string;
}

export interface Listing {
  titre: string;
  description: string;
  categorie: string;
  marque: string;
  taille: string;
  etat: string;
  couleur: string;
  matiere: string;
  motsCles: string[];
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  searches: number;
}

export interface SearchParams {
  niche: string;
  coefficient: number;
  mode: Mode;
  source: SourceId;
  realPrices: number[];
}

export interface ResultItem {
  evaluation: Evaluation;
  listing: Listing | null;
}

export interface RunResult {
  id: string;
  date: string;
  params: SearchParams;
  items: ResultItem[]; // produits retenus avec fiche
  rejected: Evaluation[]; // produits écartés
  usage: Usage;
}
