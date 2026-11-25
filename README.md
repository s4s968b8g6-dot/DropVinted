# Revendo — générateur de fiches Vinted

Tu donnes une niche et un coefficient. L'app :
1. trouve des produits (CJ Dropshipping, recherche IA sur AliExpress, ou ta saisie manuelle) ;
2. estime le prix du marché Vinted (IA) ou utilise les prix réels que tu colles ;
3. calcule prix de vente et marge, et écarte ce qui est trop cher ou trop lent ;
4. rédige 3 à 4 fiches Vinted prêtes à copier.

Page **Photos** : détoure et met en valeur **tes vraies photos** (tout se fait dans ton navigateur, gratuit).

## Règles de prix (dans `src/lib/pricing.ts`)
- Prix de vente = (prix d'achat + livraison) × coefficient (2,5 par défaut), arrondi à l'euro supérieur.
- Produit écarté si : prix de vente > médiane du marché + 10 %, ou délai > 5 jours en mode Dropship, ou prix d'achat inconnu.
- Les 4 produits avec la plus grosse marge sont gardés.

## Variables d'environnement
Voir `.env.example`. Le minimum : `GEMINI_API_KEY` et `CJ_API_KEY`.

## Limites à connaître
- L'estimation du prix Vinted par l'IA est **approximative** : vérifie avec de vraies annonces (champ « Prix Vinted réels »).
- CJ donne ses prix en dollars (convertis avec `USD_EUR_RATE`) et la livraison n'est pas toujours connue : elle est alors estimée à `CJ_SHIPPING_EUR`.
- Vinted interdit le dropshipping d'articles bas de gamme et les photos fournisseur : utilise tes propres photos.

## Lancer en local (optionnel)
```
npm install
cp .env.example .env.local   # puis remplis tes clés
npm run dev                  # ouvre http://localhost:3000
npm test                     # tests de la logique de prix
```

## Repasser sur Claude plus tard
Dans Vercel : `AI_PROVIDER=anthropic` et `ANTHROPIC_API_KEY=...`, puis redéploie.
