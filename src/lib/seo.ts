/** Constantes de SEO compartidas. Estaban repetidas en layout, sitemap y ficha. */
export const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mudave.com";

/** Nombre de la marca en texto. El logo dibujado es src/components/Logo.tsx. */
export const MARCA = "Mudave";

/**
 * Base de Open Graph. Hay que repetirla en cada generateMetadata que defina
 * `openGraph`: Next fusiona los metadatos de forma superficial, asi que el objeto
 * de la pagina SUSTITUYE al del layout en vez de completarlo.
 */
export const OG_BASE = {
  type: "website",
  locale: "es_VE",
  siteName: MARCA,
} as const;
