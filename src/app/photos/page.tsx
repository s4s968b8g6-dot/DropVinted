"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "pret" | "detourage" | "ok" | "erreur";

interface Photo {
  id: string;
  name: string;
  original: ImageBitmap;
  cutout?: ImageBitmap;
  status: Status;
  error?: string;
}

interface Settings {
  removeBg: boolean;
  bg: string;
  shadow: boolean;
  brightness: number; // -50..50
  contrast: number; // -50..50
  ratio: "3:4" | "4:5" | "1:1";
  margin: number; // % de marge autour du produit
}

const RATIOS: Record<Settings["ratio"], [number, number]> = { "3:4": [3, 4], "4:5": [4, 5], "1:1": [1, 1] };
const BGS = [
  { label: "Blanc", value: "#ffffff" },
  { label: "Gris clair", value: "#efefed" },
  { label: "Beige", value: "#f1ebe1" },
];

/** Ajuste luminosité / contraste pixel par pixel (marche aussi sur iPhone). */
function adjust(ctx: CanvasRenderingContext2D, w: number, h: number, brightness: number, contrast: number) {
  if (!brightness && !contrast) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const c = contrast * 2.55;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const b = brightness * 2.55;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = f * (d[i] - 128) + 128 + b;
    d[i + 1] = f * (d[i + 1] - 128) + 128 + b;
    d[i + 2] = f * (d[i + 2] - 128) + 128 + b;
  }
  ctx.putImageData(img, 0, 0);
}

/** Dessine la photo finale dans un canvas de largeur outW. */
function render(photo: Photo, s: Settings, canvas: HTMLCanvasElement, outW: number) {
  const [rw, rh] = RATIOS[s.ratio];
  const W = outW;
  const H = Math.round((outW * rh) / rw);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);

  const useCutout = s.removeBg && photo.cutout;
  const src = useCutout ? photo.cutout! : photo.original;
  let dx: number, dy: number, dw: number, dh: number;
  if (useCutout) {
    // produit détouré : centré avec une marge
    const boxW = W * (1 - (2 * s.margin) / 100);
    const boxH = H * (1 - (2 * s.margin) / 100);
    const scale = Math.min(boxW / src.width, boxH / src.height);
    dw = src.width * scale;
    dh = src.height * scale;
    dx = (W - dw) / 2;
    dy = (H - dh) / 2;
  } else {
    // photo d'origine : recadrage pour remplir le format
    const scale = Math.max(W / src.width, H / src.height);
    dw = src.width * scale;
    dh = src.height * scale;
    dx = (W - dw) / 2;
    dy = (H - dh) / 2;
  }

  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(dw));
  tmp.height = Math.max(1, Math.round(dh));
  const tctx = tmp.getContext("2d")!;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(src, 0, 0, tmp.width, tmp.height);
  adjust(tctx, tmp.width, tmp.height, s.brightness, s.contrast);

  if (useCutout && s.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = W * 0.04;
    ctx.shadowOffsetY = W * 0.02;
  }
  ctx.drawImage(tmp, dx, dy, dw, dh);
  ctx.shadowColor = "transparent";
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export impossible"))), "image/jpeg", 0.92),
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const cleanName = (name: string, i: number) =>
  `vinted-${String(i + 1).padStart(2, "0")}-${name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30)}.jpg`;

function Preview({ photo, settings }: { photo: Photo; settings: Settings }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) render(photo, settings, ref.current, 600);
  }, [photo, settings]);
  return <canvas ref={ref} className="h-auto w-full rounded-lg border border-stone-200" />;
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [progress, setProgress] = useState("");
  const [drag, setDrag] = useState(false);
  const [s, setS] = useState<Settings>({
    removeBg: true,
    bg: "#ffffff",
    shadow: true,
    brightness: 5,
    contrast: 5,
    ratio: "3:4",
    margin: 8,
  });

  const update = (id: string, patch: Partial<Photo>) =>
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const added: Photo[] = [];
    for (const f of list) {
      try {
        const original = await createImageBitmap(f);
        added.push({ id: crypto.randomUUID(), name: f.name, original, status: "pret" });
        (added[added.length - 1] as Photo & { file?: File }).file = f;
      } catch {
        // format non lu par le navigateur (ex. HEIC sur PC)
        alert(`Impossible de lire « ${f.name} ». Sur iPhone, choisis le format "Le plus compatible" (JPEG) dans Réglages > Appareil photo > Formats.`);
      }
    }
    setPhotos((ps) => [...ps, ...added]);
  }, []);

  async function removeAll() {
    const { removeBackground } = await import("@imgly/background-removal");
    for (const p of photos) {
      if (p.cutout) continue;
      update(p.id, { status: "detourage", error: undefined });
      try {
        const file = (p as Photo & { file?: File }).file;
        if (!file) throw new Error("Fichier introuvable");
        const blob = await removeBackground(file, {
          model: "isnet_quint8",
          output: { format: "image/png" },
          progress: (key, cur, total) => {
            if (key.startsWith("fetch")) setProgress(`Téléchargement du modèle de détourage (1re fois seulement)… ${Math.round((cur / total) * 100)} %`);
            else setProgress("Détourage en cours…");
          },
        });
        update(p.id, { cutout: await createImageBitmap(blob), status: "ok" });
      } catch (e) {
        update(p.id, { status: "erreur", error: e instanceof Error ? e.message : "Erreur" });
      }
    }
    setProgress("");
  }

  async function exportOne(p: Photo, i: number) {
    const c = document.createElement("canvas");
    render(p, s, c, 1200);
    download(await toBlob(c), cleanName(p.name, i));
  }

  async function exportZip() {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const [i, p] of photos.entries()) {
      const c = document.createElement("canvas");
      render(p, s, c, 1200);
      zip.file(cleanName(p.name, i), await toBlob(c));
    }
    download(await zip.generateAsync({ type: "blob" }), "photos-vinted.zip");
  }

  const needsCutout = s.removeBg && photos.some((p) => !p.cutout);
  const working = photos.some((p) => p.status === "detourage");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Photos pro pour Vinted</h1>
        <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Utilise des photos de <b>ton propre article</b> : Vinted interdit les photos fournisseur ou commerciales.
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center ${drag ? "border-emerald-600 bg-emerald-50" : "border-stone-300 bg-white"}`}
      >
        <span className="text-3xl">📷</span>
        <span className="mt-2 font-semibold">Ajoute tes photos</span>
        <span className="text-sm text-stone-500">Glisse-les ici ou appuie pour choisir</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </label>

      {photos.length > 0 && (
        <>
          <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.removeBg} onChange={(e) => setS({ ...s, removeBg: e.target.checked })} />
              Enlever le fond
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.shadow} disabled={!s.removeBg} onChange={(e) => setS({ ...s, shadow: e.target.checked })} />
              Ombre légère
            </label>
            <div className="flex flex-wrap items-center gap-2">
              Fond :
              {BGS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setS({ ...s, bg: b.value })}
                  className={`rounded-md border px-2 py-1 ${s.bg === b.value ? "border-emerald-700 ring-2 ring-emerald-200" : "border-stone-300"}`}
                  style={{ background: b.value }}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              Format :
              <select value={s.ratio} onChange={(e) => setS({ ...s, ratio: e.target.value as Settings["ratio"] })} className="rounded-md border border-stone-300 px-2 py-1">
                <option value="3:4">Portrait 3:4</option>
                <option value="4:5">Portrait 4:5</option>
                <option value="1:1">Carré 1:1</option>
              </select>
            </label>
            <label>
              Luminosité ({s.brightness})
              <input type="range" min={-50} max={50} value={s.brightness} onChange={(e) => setS({ ...s, brightness: +e.target.value })} className="w-full" />
            </label>
            <label>
              Contraste ({s.contrast})
              <input type="range" min={-50} max={50} value={s.contrast} onChange={(e) => setS({ ...s, contrast: +e.target.value })} className="w-full" />
            </label>
            <label className="sm:col-span-2">
              Marge autour du produit ({s.margin} %)
              <input type="range" min={0} max={25} value={s.margin} onChange={(e) => setS({ ...s, margin: +e.target.value })} className="w-full" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {needsCutout && (
              <button onClick={removeAll} disabled={working} className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
                {working ? "Détourage…" : "Détourer les photos"}
              </button>
            )}
            <button onClick={exportZip} disabled={working} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 font-semibold disabled:opacity-60">
              Tout télécharger (.zip)
            </button>
            <button onClick={() => setPhotos([])} className="rounded-xl px-4 py-2.5 text-stone-500">
              Tout effacer
            </button>
          </div>
          {progress && <p className="text-sm text-stone-600">{progress}</p>}
          {needsCutout && !working && (
            <p className="text-xs text-stone-500">Le détourage se fait sur ton appareil (gratuit). La 1re fois, il télécharge un modèle d&apos;environ 40 Mo : plus rapide sur ordinateur.</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <div key={p.id} className="space-y-1.5">
                <Preview photo={p} settings={s} />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-stone-500">
                    {p.status === "detourage" ? "⏳ détourage…" : p.status === "erreur" ? `⚠️ ${p.error}` : p.cutout ? "✓ détourée" : p.name}
                  </span>
                  <button onClick={() => exportOne(p, i)} className="shrink-0 rounded-md border border-stone-300 bg-white px-2 py-1 font-medium">
                    ↓ JPEG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
