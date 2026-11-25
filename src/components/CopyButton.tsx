"use client";

import { useState } from "react";
import { copyText } from "@/lib/client";

export function CopyButton({ text, label = "Copier", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "ko">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? "ok" : "ko");
        setTimeout(() => setState("idle"), 1500);
      }}
      className={`shrink-0 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 active:scale-95 ${className}`}
    >
      {state === "ok" ? "Copié ✓" : state === "ko" ? "Échec" : label}
    </button>
  );
}

export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-stone-100 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
        <div className={`text-sm text-stone-900 ${multiline ? "whitespace-pre-line" : "break-words"}`}>{value}</div>
      </div>
      <CopyButton text={value} />
    </div>
  );
}
