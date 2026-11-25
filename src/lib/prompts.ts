// Tous les textes envoyés à l'IA sont ici : facile à ajuster sans toucher au reste.
import type { Mode, SupplierProduct } from "./types";

export const SYSTEM_FR =
  "Tu es un assistant expert de la revente sur Vinted France. Tu es factuel, prudent avec les chiffres, et tu ne inventes jamais de marque ni de caractéristique.";

export function keywordsPrompt(niche: string): string {
  return `Niche de revente : "${niche}".
Donne 3 mots-clés de recherche EN ANGLAIS (2 à 4 mots chacun) pour trouver ce type de produit chez un grossiste (CJ Dropshipping).
Du plus précis au plus large.
Réponds uniquement en JSON : {"keywords": ["...", "...", "..."]}`;
}

export function aiWebSearchPrompt(niche: string, mode: Mode, limit: number): string {
  return `Cherche sur AliExpress (aliexpress.com ou fr.aliexpress.com) ${limit} produits réels qui correspondent à la niche "${niche}" pour les revendre sur Vinted France.
${mode === "dropship" ? "IMPORTANT : privilégie les produits expédiés depuis un entrepôt en France ou en Europe avec livraison en 5 jours maximum. Indique le délai réel annoncé." : "Le délai de livraison est secondaire (achat de stock à l'avance), mais indique-le."}
Choisis des produits avec un bon potentiel sur Vinted (tendance, look, prix d'achat bas). Pas de contrefaçon, pas de marque déposée.

Pour chaque produit, donne les infos trouvées sur la page (en euros). Si une info est inconnue, mets null. N'invente pas de lien : uniquement des URL que tu as vraiment trouvées.

Réponds UNIQUEMENT avec ce JSON :
{"products": [{"title": "nom du produit", "url": "https://...", "imageUrl": "https://... ou null", "priceEUR": 3.5, "shippingEUR": 1.99, "deliveryDaysMax": 12, "warehouse": "CN", "attributes": {"matiere": "...", "couleurs": "..."}}]}`;
}

export function marketPrompt(niche: string, products: { title: string; attributes?: Record<string, string> }[]): string {
  const list = products
    .map((p, i) => `${i}. ${p.title}${p.attributes ? ` (${Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""}`)
    .join("\n");
  return `Niche : "${niche}".
Pour chaque produit ci-dessous, estime le prix auquel un article équivalent (neuf ou très bon état, sans marque connue) se vend réellement sur Vinted France aujourd'hui.
Appuie-toi sur des recherches web (annonces Vinted, prix constatés). Sois prudent : mieux vaut sous-estimer que surestimer. Donne des prix en euros, hors frais de port et hors frais de protection acheteur.

Produits :
${list}

Réponds UNIQUEMENT avec ce JSON (un élément par produit, même index) :
{"estimations": [{"index": 0, "min": 8, "median": 12, "max": 18, "confiance": "faible|moyenne|haute", "justification": "une phrase courte"}]}`;
}

export function listingsPrompt(
  niche: string,
  items: { product: SupplierProduct; prixVente: number }[],
): string {
  const list = items
    .map(
      (it, i) =>
        `${i}. ${it.product.title} — prix de vente ${it.prixVente} €${
          it.product.attributes ? ` — infos fournisseur : ${Object.entries(it.product.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""
        }`,
    )
    .join("\n");
  return `Rédige une fiche Vinted France pour chacun de ces produits de la niche "${niche}".

Produits :
${list}

Règles :
- "titre" : 60 caractères max, mots-clés en premier (type + style + couleur + taille si connue). Pas de majuscules partout.
- "description" : 5 à 8 lignes, ton naturel de particulier, en français correct. Parle de l'état, de la matière, de la taille/dimensions, d'un conseil d'entretien. Termine par 3 à 6 hashtags de la niche sur la dernière ligne. 2 emojis maximum.
- "categorie" : chemin de catégorie Vinted, ex. "Hommes > Accessoires > Chapeaux & casquettes".
- "marque" : "Sans marque" sauf si une vraie marque est clairement indiquée. N'invente JAMAIS une marque connue.
- "taille", "couleur", "matiere" : si inconnu, écris "À préciser".
- "etat" : "Neuf sans étiquette" par défaut.
- "motsCles" : 5 à 8 mots-clés de recherche Vinted.
- Interdit : "original", "authentique", "officiel" pour un produit générique ; promesses invérifiables ; mention du fournisseur ou du dropshipping.

Réponds UNIQUEMENT avec ce JSON (même ordre que la liste) :
{"fiches": [{"index": 0, "titre": "", "description": "", "categorie": "", "marque": "", "taille": "", "etat": "", "couleur": "", "matiere": "", "motsCles": [""]}]}`;
}
