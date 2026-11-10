import type { Metadata } from "next";
import Link from "next/link";
import { Figtree } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { LISTINGS, LOCATIONS, rutaListado, destacadosPorOperacion, tiposConEnlace } from "@/lib/data";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { SITIO, OG_BASE, MARCA } from "@/lib/seo";
import { sugerenciasBusqueda } from "@/lib/search";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: {
    default: `${MARCA} | Apartamentos y casas en venta y alquiler en Venezuela`,
    template: `%s | ${MARCA}`,
  },
  // las ciudades salen de la data: con el lanzamiento escalonado cambian cada semana
  description: `Portal inmobiliario de Venezuela. Apartamentos, casas, quintas y townhouses en venta y alquiler en ${
    new Intl.ListFormat("es", { type: "conjunction" }).format(
      LOCATIONS.flatMap((e) => e.ciudades).sort((a, b) => b.total - a.total).map((c) => c.nombre))
  }.`,
  alternates: { languages: { "es-VE": "/" } },
  // hasta ahora cada enlace compartido por WhatsApp —el unico canal de conversion—
  // llegaba sin imagen, sin titulo y sin precio
  openGraph: OG_BASE,
  twitter: { card: "summary_large_image" },
};

/** Columna de enlaces del footer. Interlinking real, no decoracion. */
function Columna({ titulo, enlaces }: { titulo: string; enlaces: { href: string; label: string; total?: number }[] }) {
  if (!enlaces.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold">{titulo}</p>
      <ul className="mt-3 space-y-2">
        {enlaces.map((e) => (
          <li key={e.href}>
            <Link href={e.href} className="text-sm text-tinta-2 transition-colors hover:text-acento hover:underline">
              {e.label}
              {e.total !== undefined && <span className="tabular ml-1 text-xs text-tinta-3">{e.total}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  const ciudades = LOCATIONS.flatMap((e) => e.ciudades).sort((a, b) => b.total - a.total);
  const barrios = ciudades.reduce((n, c) => n + c.barrios.length, 0);

  const tipos = tiposConEnlace().slice(0, 6);

  return (
    <footer className="mt-16">
      <div className="border-t border-borde-suave bg-crema">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
            <div>
              <p><Logo className="text-[1.75rem]" /></p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-tinta-2">
                El portal inmobiliario de Venezuela. Precios en dólares y contacto directo
                con quien publica cada inmueble.
              </p>
              <dl className="mt-5 flex gap-6">
                {[
                  { k: "Inmuebles", v: LISTINGS.length.toLocaleString("es-VE"), c: "text-acento" },
                  { k: "Ciudades", v: String(ciudades.length), c: "text-mar" },
                  { k: "Zonas", v: String(barrios), c: "text-ambar" },
                ].filter((s) => s.k !== "Ciudades" || ciudades.length > 1).map((s) => (
                  <div key={s.k}>
                    <dt className="text-xs text-tinta-2">{s.k}</dt>
                    <dd className={`tabular text-xl font-bold ${s.c}`}>{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Columna titulo="Comprar" enlaces={destacadosPorOperacion("venta")} />
            <Columna titulo="Alquilar" enlaces={destacadosPorOperacion("alquiler")} />
            <Columna titulo="Ciudades" enlaces={ciudades.map((c) => ({
              href: rutaListado("venta", "apartamento", [c.slug, c.estado]),
              label: c.nombre, total: c.total,
            }))} />
            <Columna titulo="Tipo de inmueble" enlaces={tipos} />
          </div>
        </div>
      </div>

      <div className="border-t border-borde-suave bg-crema">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-tinta-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {MARCA} · Mapas © OpenFreeMap, © OpenMapTiles, © OpenStreetMap</p>
          <p className="max-w-xl sm:text-right">
            Los inmuebles son publicados por agentes e inmobiliarias. Verifica siempre los datos
            y la documentación directamente con el anunciante.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const sugerencias = sugerenciasBusqueda();

  return (
    <html lang="es-VE" className={`${figtree.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Identidad del sitio. Google retiró el sitelinks search box, por eso la
            búsqueda interna no se marca como SearchAction. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
          {
            "@context": "https://schema.org", "@type": "Organization",
            name: MARCA, url: SITIO, description: metadata.description,
            areaServed: { "@type": "Country", name: "Venezuela" },
          },
          { "@context": "https://schema.org", "@type": "WebSite", name: MARCA, url: SITIO, inLanguage: "es-VE" },
        ]) }} />
        {/* Google Tag Manager. Carga tras la hidratacion: no compite con el LCP. */}
        <Script id="gtm-init">{`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());`}</Script>
        <Script src="https://www.googletagmanager.com/gtm.js?id=GTM-WJ8SCGQM" />
        <Header sugerencias={sugerencias} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
