import type { MetadataRoute } from "next";
import { LISTINGS, combinacionesConInventario, facetasConInventario, rutaListado, rutaPagina, canonicaListado, rutaFicha, esIndexable } from "@/lib/data";

import { SITIO as SITE } from "@/lib/seo";
export { SITE };

/**
 * Solo URLs indexables: una URL en noindex dentro del sitemap es una senal contradictoria
 * y desperdicia crawl budget (ROADMAP §10.4).
 *
 * ponytail: un solo sitemap. El techo son 50.000 URLs; hoy hay ~1.700. Cuando se acerque,
 * segmentar por nivel con generateSitemaps().
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    ...combinacionesConInventario()
      // una URL que canonicaliza hacia otra no va al sitemap: seria una senal contradictoria
      .filter((c) => esIndexable(c.total) &&
        canonicaListado(c.operacion, c.tipo, c.ubicacion) === rutaListado(c.operacion, c.tipo, c.ubicacion))
      .map((c) => ({
        url: `${SITE}${rutaListado(c.operacion, c.tipo, c.ubicacion)}`,
        changeFrequency: "daily" as const,
        priority: c.ubicacion.length === 2 ? 0.9 : c.ubicacion.length === 1 ? 0.8 : 0.6,
      })),
    // facetas de habitaciones: indexables y con demanda propia
    ...facetasConInventario()
      .filter((f) => canonicaListado(f.operacion, f.tipo, f.ubicacion, 1, f.habitaciones)
        === rutaPagina(f.operacion, f.tipo, f.ubicacion, 1, f.habitaciones))
      .map((f) => ({
        url: `${SITE}${rutaPagina(f.operacion, f.tipo, f.ubicacion, 1, f.habitaciones)}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...LISTINGS.filter((l) => l.indexable).map((l) => ({
      url: `${SITE}${rutaFicha(l)}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
