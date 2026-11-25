// Source CJ Dropshipping (API officielle, gratuite avec un compte).
// Doc : https://developers.cjdropshipping.com/en/api/api2/api/product.html
import "server-only";
import type { Mode, SupplierProduct } from "../types";
import { toNumber } from "../json";
import { SourceError } from "./errors";

const BASE = `${process.env.CJ_BASE_URL || "https://developers.cjdropshipping.com"}/api2.0/v1`;

// Le jeton d'accès est gardé en mémoire (CJ limite le nombre de demandes de jeton).
let cached: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (process.env.CJ_ACCESS_TOKEN) return process.env.CJ_ACCESS_TOKEN;
  if (cached && cached.expires > Date.now()) return cached.token;
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) throw new SourceError("Clé CJ manquante : ajoute CJ_API_KEY dans les variables d'environnement.", 400);

  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => {
    console.error("CJ auth fetch", e);
    return null;
  });
  const data = await res?.json().catch(() => null);
  const token: string | undefined = data?.data?.accessToken;
  if (!res?.ok || !token) {
    const msg: string = data?.message ?? "";
    if (/too many|frequen|limit/i.test(msg))
      throw new SourceError("CJ limite les connexions : attends 5 minutes puis réessaie.", 429);
    throw new SourceError(
      `Connexion à CJ impossible${msg ? ` (${msg})` : ""}. Vérifie CJ_API_KEY (copie-la en entier, avec le début "CJ...@api@").`,
      401,
    );
  }
  const expiry = Date.parse(data?.data?.accessTokenExpiryDate ?? "");
  cached = { token, expires: Number.isFinite(expiry) ? expiry - 3600_000 : Date.now() + 7 * 24 * 3600_000 };
  return token;
}

function envNumber(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface CjProduct {
  id?: string;
  nameEn?: string;
  sku?: string;
  bigImage?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  discountPrice?: string | number;
  addMarkStatus?: number;
  deliveryCycle?: string;
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
  warehouseInventoryNum?: number;
}

async function listProducts(token: string, keyWord: string, countryCode?: string): Promise<CjProduct[]> {
  const params = new URLSearchParams({ keyWord, page: "1", size: "30" });
  if (countryCode) params.set("countryCode", countryCode);
  const res = await fetch(`${BASE}/product/listV2?${params}`, {
    headers: { "CJ-Access-Token": token },
    signal: AbortSignal.timeout(25_000),
  }).catch((e) => {
    console.error("CJ list fetch", e);
    return null;
  });
  const data = await res?.json().catch(() => null);
  if (!res?.ok || data?.result === false) {
    if (res?.status === 401 || data?.code === 1600001) cached = null;
    throw new SourceError(`Recherche CJ impossible${data?.message ? ` (${data.message})` : ""}.`, 502);
  }
  const content: { productList?: CjProduct[] }[] = data?.data?.content ?? [];
  return content.flatMap((c) => c.productList ?? []);
}

export async function searchCj(params: { keywords: string[]; mode: Mode; limit: number }): Promise<SupplierProduct[]> {
  const token = await getAccessToken();
  const rate = envNumber("USD_EUR_RATE", 0.9); // CJ affiche les prix en dollars
  const defaultShipping = envNumber("CJ_SHIPPING_EUR", 4.5); // estimation si la livraison n'est pas gratuite
  const country = params.mode === "dropship" ? "FR" : undefined;

  const seen = new Set<string>();
  const products: SupplierProduct[] = [];
  for (const [i, kw] of params.keywords.entries()) {
    if (products.length >= params.limit) break;
    if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // CJ limite à ~1 requête/seconde
    const list = await listProducts(token, kw, country);
    for (const p of list) {
      if (products.length >= params.limit) break;
      const key = p.id ?? p.sku ?? p.nameEn ?? "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const usd = [p.nowPrice, p.discountPrice, p.sellPrice].map((v) => toNumber(v, "max")).find((n) => n > 0);
      if (!usd) continue;
      const days = p.deliveryCycle ? toNumber(p.deliveryCycle, "max") : NaN;
      const freeShipping = p.addMarkStatus === 1;
      products.push({
        source: "cj",
        title: p.nameEn ?? "Produit CJ",
        url: p.id ? `https://cjdropshipping.com/product/-p-${p.id}.html` : "https://cjdropshipping.com",
        imageUrl: p.bigImage,
        sku: p.sku,
        priceEUR: Math.round(usd * rate * 100) / 100,
        shippingEUR: freeShipping ? 0 : defaultShipping,
        shippingEstimated: !freeShipping,
        deliveryDaysMax: Number.isFinite(days) ? days : null,
        warehouse: country,
        attributes: Object.fromEntries(
          Object.entries({
            categorie: [p.oneCategoryName, p.twoCategoryName, p.threeCategoryName].filter(Boolean).join(" > "),
            stock: p.warehouseInventoryNum != null ? String(p.warehouseInventoryNum) : "",
          }).filter(([, v]) => v),
        ),
        dataConfidence: "api",
      });
    }
  }
  return products;
}
