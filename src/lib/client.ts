// Fonctions utilisées par l'interface (navigateur).
import type { RunResult, Usage } from "./types";

export async function api<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Pas de connexion au serveur. Vérifie ta connexion internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 504) throw new Error("Le serveur a mis trop de temps à répondre. Réessaie.");
    throw new Error(data?.error ?? `Erreur ${res.status}`);
  }
  return data as T;
}

export function addUsage(a: Usage, b?: Usage): Usage {
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    searches: a.searches + b.searches,
  };
}

const KEY = "revendo_historique";
const MAX = 30;

export function loadHistory(): RunResult[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RunResult[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: RunResult): void {
  try {
    const list = loadHistory().filter((r) => r.id !== run.id);
    list.unshift(run);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // stockage plein ou indisponible : pas bloquant
  }
}

export function deleteRun(id: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loadHistory().filter((r) => r.id !== id)));
  } catch {
    // ignore
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Méthode de secours (anciens navigateurs / iPhone)
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function euro(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}
