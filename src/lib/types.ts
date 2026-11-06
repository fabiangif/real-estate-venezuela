export type Operacion = "venta" | "alquiler";

export type Tipo =
  | "apartamento" | "casa" | "quinta" | "townhouse" | "penthouse" | "anexo"
  | "oficina" | "local" | "terreno" | "galpon";

/** Una ficha publicable. Un aviso que se vende Y se alquila produce dos. */
export type Listing = {
  publicId: string;            // "<shortcode>-venta"
  slug: string;                // "apartamento-venta-del-este-barquisimeto"
  operacion: Operacion;
  tipo: Tipo;

  estado: string;              // slug
  estadoNombre: string;
  ciudad: string;              // slug
  ciudadNombre: string;
  barrio: string | null;       // slug
  barrioNombre: string | null;

  precio: number | null;       // USD. null => "Precio a consultar"
  titulo: string;
  descripcion: string | null;

  m2: number | null;
  areaTerreno: number | null;
  habitaciones: number | null;
  banos: number | null;
  estacionamientos: number | null;
  amoblado: boolean | null;
  amenidades: string[];

  whatsapp: string | null;     // E.164. null => se cae al perfil de Instagram
  fotos: string[];             // URLs públicas verificadas en el CDN
  fotosCount: number;          // cuántas imágenes verificadas existen
  videos: string[];            // videos MP4 públicos verificados en el CDN
  videosCount: number;

  fuente: { handle: string | null; postUrl: string | null; driveUrl: string | null };
  dataQuality: "completo" | "parcial";
  indexable: boolean;
};

export type Barrio = { slug: string; nombre: string; total: number };
export type Ciudad = { slug: string; nombre: string; estado: string; estadoNombre: string; total: number; barrios: Barrio[] };
export type Estado = { slug: string; nombre: string; total: number; ciudades: Ciudad[] };

export const TIPO_LABEL: Record<Tipo, { singular: string; plural: string; slug: string }> = {
  apartamento: { singular: "Apartamento", plural: "Apartamentos", slug: "apartamentos" },
  casa:        { singular: "Casa",        plural: "Casas",        slug: "casas" },
  quinta:      { singular: "Quinta",      plural: "Quintas",      slug: "quintas" },
  townhouse:   { singular: "Townhouse",   plural: "Townhouses",   slug: "townhouses" },
  penthouse:   { singular: "Penthouse",   plural: "Penthouses",   slug: "penthouses" },
  anexo:       { singular: "Anexo",       plural: "Anexos",       slug: "anexos" },
  oficina:     { singular: "Oficina",     plural: "Oficinas",     slug: "oficinas" },
  local:       { singular: "Local comercial", plural: "Locales comerciales", slug: "locales" },
  terreno:     { singular: "Terreno",     plural: "Terrenos",     slug: "terrenos" },
  galpon:      { singular: "Galpón",      plural: "Galpones",     slug: "galpones" },
};

/**
 * Familia del inmueble. Da color a los iconos y agrupa secciones:
 * el color CLASIFICA (dónde vives / dónde trabajas / suelo), no decora.
 */
export type Familia = "residencial" | "comercial" | "suelo";

export const FAMILIA: Record<Tipo, Familia> = {
  apartamento: "residencial", casa: "residencial", quinta: "residencial",
  townhouse: "residencial", penthouse: "residencial", anexo: "residencial",
  oficina: "comercial", local: "comercial", galpon: "comercial",
  terreno: "suelo",
};

/** Clase de color por familia. Tailwind necesita la clase completa, sin interpolar. */
export const COLOR_FAMILIA: Record<Familia, string> = {
  residencial: "text-acento",
  comercial: "text-mar",
  suelo: "text-ambar",
};

export const OPERACION_LABEL: Record<Operacion, string> = { venta: "Venta", alquiler: "Alquiler" };

/** Slug sin acentos ni espacios. Unica fuente de verdad para las URLs. */
export function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatPrecio(n: number | null): string {
  return n === null ? "Precio a consultar" : `US$ ${n.toLocaleString("es-VE")}`;
}
