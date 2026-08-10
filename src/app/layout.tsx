import type { Metadata } from "next";
import Link from "next/link";
import { Figtree } from "next/font/google";
import "./globals.css";
import { LISTINGS, LOCATIONS, rutaListado, destacadosPorOperacion, tiposConEnlace } from "@/lib/data";
import { Header } from "@/components/Header";
import { SITIO, OG_BASE } from "@/lib/seo";
import { TIPO_LABEL, type Tipo } from "@/lib/types";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: {
    default: "Inmuebles VE — Apartamentos y casas en venta y alquiler en Venezuela",
    template: "%s | Inmuebles VE",
  },
  description:
    "Portal inmobiliario de Venezuela. Apartamentos, casas, quintas y townhouses en venta y alquiler en Caracas, Maracaibo, Valencia, Maracay y Barquisimeto.",
  alternates: { languages: { "es-VE": "/" } },
  // hasta ahora cada enlace compartido por WhatsApp —el unico canal de conversion—
  // llegaba sin imagen, sin titulo y sin precio
  openGraph: OG_BASE,
  twitter: { card: "summary_large_image" },
};

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Inmuebles VE, inicio">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m3 10.5 9-7 9 7V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="text-acento" />
        <path d="M9.5 21v-6h5v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="text-acento" />
      </svg>
      <span className="text-lg font-bold tracking-[-0.02em]">
        Inmuebles<span className="text-acento">VE</span>
      </span>
    </Link>
  );
}

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
      {/* banda de color en TODAS las paginas: el sitio deja de ser blanco y negro
          fuera de la Home, y el CTA de publicar viaja con el usuario */}
      <section id="publicar" className="scroll-mt-24 bg-acento">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold tracking-[-0.01em]">¿Tienes un inmueble? Publícalo gratis</p>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Envíanos las fotos y los datos y aparecerá en las búsquedas de tu ciudad y tu urbanización.
            </p>
          </div>
          <span className="self-start rounded-full bg-white px-5 py-3 text-sm font-semibold text-acento sm:self-auto">
            Publicar inmueble
          </span>
        </div>
      </section>

      <div className="border-t border-borde-suave bg-crema">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
            <div>
              <p className="text-lg font-bold tracking-[-0.02em]">
                Inmuebles<span className="text-acento">VE</span>
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-tinta-2">
                El portal inmobiliario de Venezuela. Precios en dólares y contacto directo
                con quien publica cada inmueble.
              </p>
              <dl className="mt-5 flex gap-6">
                {[
                  { k: "Inmuebles", v: LISTINGS.length.toLocaleString("es-VE"), c: "text-acento" },
                  { k: "Ciudades", v: String(ciudades.length), c: "text-mar" },
                  { k: "Zonas", v: String(barrios), c: "text-ambar" },
                ].map((s) => (
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
          <p>© {new Date().getFullYear()} Inmuebles VE · Mapas © CARTO, © OpenStreetMap</p>
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
  const ciudadesNav = LOCATIONS.flatMap((e) => e.ciudades)
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ slug: c.slug, nombre: c.nombre, estado: c.estado }));
  const tiposNav = [...new Set(LISTINGS.map((l) => l.tipo))] as Tipo[];

  return (
    <html lang="es-VE" className={`${figtree.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* identidad del sitio. Sin SearchAction todavia: requiere una URL de busqueda
            por texto que aun no existe, y declararla apuntando a nada seria una senal falsa */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
          {
            "@context": "https://schema.org", "@type": "Organization",
            name: "Inmuebles VE", url: SITIO, description: metadata.description,
            areaServed: { "@type": "Country", name: "Venezuela" },
          },
          { "@context": "https://schema.org", "@type": "WebSite", name: "Inmuebles VE", url: SITIO, inLanguage: "es-VE" },
        ]) }} />
        <Header ciudades={ciudadesNav} tipos={tiposNav} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
