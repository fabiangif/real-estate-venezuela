import type { MetadataRoute } from "next";
import { SITE } from "./sitemap";

/**
 * Solo se bloquea lo que de verdad es un espacio infinito: los resultados del buscador.
 *
 * Antes era `Disallow: /*?`, pensado para futuros filtros por query param. Bloqueaba
 * mucho mas de lo que decia: todas las fotos (/_next/image?url=…), la tarjeta de
 * previsualizacion (/api/og?id=…) y el favicon (/icon.svg?…), y dejaba fuera cualquier
 * enlace compartido con ?utm_…. Sin errores ni avisos: Google simplemente no veia imagenes.
 *
 * Las URLs con parametros que no estan aqui ya apuntan su canonical a la URL limpia.
 * Cuando existan filtros por query param, se bloquea SU patron (p. ej. "/*?*precio="),
 * nunca todo lo que lleve "?".
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/buscar?"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
