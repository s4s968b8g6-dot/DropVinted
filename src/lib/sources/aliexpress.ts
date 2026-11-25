// Squelette pour l'API officielle AliExpress (programme affiliés / Open Platform).
// À compléter quand tu auras ALIEXPRESS_APP_KEY et ALIEXPRESS_APP_SECRET.
// Il suffira de renvoyer des SupplierProduct, puis d'activer la source dans sources/index.ts.
import "server-only";
import type { Mode, SupplierProduct } from "../types";
import { SourceError } from "./errors";

export async function searchAliExpress(_params: { keywords: string[]; mode: Mode; limit: number }): Promise<SupplierProduct[]> {
  void _params;
  throw new SourceError("API AliExpress pas encore configurée.", 501);
}
