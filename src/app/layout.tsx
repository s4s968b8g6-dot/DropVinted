import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revendo — fiches Vinted",
  description: "Trouve des produits, vérifie la marge et génère des fiches Vinted prêtes à copier.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-stone-100 text-stone-900">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3 text-sm">
            <Link href="/" className="mr-auto text-lg font-extrabold tracking-tight text-emerald-800">
              Revendo
            </Link>
            <Link href="/" className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100">Fiches</Link>
            <Link href="/photos" className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100">Photos</Link>
            <Link href="/historique" className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100">Historique</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
