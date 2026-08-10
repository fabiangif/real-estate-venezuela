/** Constantes de SEO compartidas. Estaban repetidas en layout, sitemap y ficha. */
export const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://inmuebles.ve";

/**
 * Base de Open Graph. Hay que repetirla en cada generateMetadata que defina
 * `openGraph`: Next fusiona los metadatos de forma superficial, asi que el objeto
 * de la pagina SUSTITUYE al del layout en vez de completarlo.
 */
export const OG_BASE = {
  type: "website",
  locale: "es_VE",
  siteName: "Inmuebles VE",
} as const;
