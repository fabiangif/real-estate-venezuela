import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slugify, TIPO_LABEL, type Listing, type Estado, type Ciudad, type Operacion, type Tipo } from "./types";

const load = <T,>(f: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), "data", f), "utf8"));

export const LISTINGS: Listing[] = load("listings.json");
export const LOCATIONS: Estado[] = load("locations.json");

export const byId = new Map(LISTINGS.map((l) => [l.publicId, l]));

const ciudades: Ciudad[] = LOCATIONS.flatMap((e) => e.ciudades);
export const ciudadPorSlug = new Map(ciudades.map((c) => [c.slug, c]));
export const estadoPorSlug = new Map(LOCATIONS.map((e) => [e.slug, e]));
/** slug de tipo en la URL ("apartamentos") -> enum ("apartamento") */
export const tipoPorSlug = new Map(
  (Object.entries(TIPO_LABEL) as [Tipo, { slug: string }][]).map(([t, v]) => [v.slug, t])
);

export type Ubicacion = { estado: Estado; ciudad?: Ciudad; barrioSlug?: string; barrioNombre?: string };

/**
 * Resuelve los segmentos de ubicacion de la URL. Tres formas validas:
 *   [estado]                    -> /venta/apartamentos/lara
 *   [ciudad, estado]            -> /venta/apartamentos/barquisimeto/lara
 *   [ciudad, estado, barrio]    -> /venta/apartamentos/barquisimeto/lara/del-este
 * Devuelve null si la combinacion no existe: el llamador responde 404.
 */
export function resolveUbicacion(seg: string[]): Ubicacion | null {
  if (seg.length === 1) {
    const estado = estadoPorSlug.get(seg[0]);
    return estado ? { estado } : null;
  }
  const [ciudadSlug, estadoSlug, barrioSlug] = seg;
  const estado = estadoPorSlug.get(estadoSlug);
  const ciudad = estado?.ciudades.find((c) => c.slug === ciudadSlug);
  if (!ciudad) return null;
  if (seg.length === 2) return { estado: estado!, ciudad };
  if (seg.length !== 3) return null;
  const barrio = ciudad.barrios.find((b) => b.slug === barrioSlug);
  return barrio ? { estado: estado!, ciudad, barrioSlug: barrio.slug, barrioNombre: barrio.nombre } : null;
}

export type Filtro = {
  operacion: Operacion;
  tipo: Tipo;
  estado: string;
  ciudad?: string;
  barrio?: string;
  habitaciones?: number;
};

export function buscar(f: Filtro): Listing[] {
  return LISTINGS.filter(
    (l) =>
      l.operacion === f.operacion &&
      l.tipo === f.tipo &&
      l.estado === f.estado &&
      (!f.ciudad || l.ciudad === f.ciudad) &&
      (!f.barrio || l.barrio === f.barrio) &&
      (!f.habitaciones || l.habitaciones === f.habitaciones)
  ).sort((a, b) => Number(b.indexable) - Number(a.indexable) || (b.precio ?? 0) - (a.precio ?? 0));
}

/** §10.4 anti-thin-content: un listado solo se indexa con 3 o mas inmuebles. */
export const UMBRAL_LISTADO = 3;
export const esIndexable = (n: number) => n >= UMBRAL_LISTADO;

/** Similares: misma ciudad, tipo y operacion, excluyendo el actual. */
export function similares(l: Listing, n = 4): Listing[] {
  return LISTINGS.filter(
    (o) => o.publicId !== l.publicId && o.ciudad === l.ciudad && o.tipo === l.tipo && o.operacion === l.operacion
  ).slice(0, n);
}

/** Combinaciones op x tipo x ubicacion con inventario real, con su conteo. */
export function combinacionesConInventario(): { operacion: Operacion; tipo: Tipo; ubicacion: string[]; total: number }[] {
  const set = new Map<string, { operacion: Operacion; tipo: Tipo; ubicacion: string[]; total: number }>();
  for (const l of LISTINGS) {
    for (const ubicacion of [[l.estado], [l.ciudad, l.estado], ...(l.barrio ? [[l.ciudad, l.estado, l.barrio]] : [])]) {
      const k = `${l.operacion}/${l.tipo}/${ubicacion.join("/")}`;
      const e = set.get(k) ?? { operacion: l.operacion, tipo: l.tipo, ubicacion, total: 0 };
      e.total++;
      set.set(k, e);
    }
  }
  return [...set.values()];
}

export const rutaListado = (operacion: Operacion, tipo: Tipo, ubicacion: string[]) =>
  `/${operacion}/${TIPO_LABEL[tipo].slug}/${ubicacion.join("/")}`;

export const rutaFicha = (l: Listing) => `/${l.slug}/${l.publicId}`;

/** 24 = multiplo de 4, que es el ancho del grid en xl. */
export const POR_PAGINA = 24;

/**
 * Constructor unico de URLs de listado: ubicacion → faceta → pagina, en ese orden.
 * La pagina 1 nunca lleva sufijo: /…/pagina/1 duplicaria la URL base.
 */
export const rutaPagina = (
  operacion: Operacion, tipo: Tipo, ubicacion: string[], pagina = 1, habitaciones?: number,
) => {
  const base = rutaListado(operacion, tipo, ubicacion) + (habitaciones ? `/${habitaciones}-habitaciones` : "");
  return pagina <= 1 ? base : `${base}/pagina/${pagina}`;
};

/** Maximo de habitaciones con faceta propia: por encima, la demanda de busqueda es nula. */
export const MAX_FACETA_HAB = 5;

/**
 * Facetas de habitaciones que superan el umbral. Es la unica faceta indexable
 * (ROADMAP §2.2.7): tiene demanda real ("apartamentos 3 habitaciones caracas").
 * El resto de filtros van por query param y los bloquea robots.txt.
 */
export function facetasConInventario() {
  const set = new Map<string, { operacion: Operacion; tipo: Tipo; ubicacion: string[]; habitaciones: number; total: number }>();
  for (const l of LISTINGS) {
    if (!l.habitaciones || l.habitaciones > MAX_FACETA_HAB) continue;
    for (const ubicacion of [[l.estado], [l.ciudad, l.estado], ...(l.barrio ? [[l.ciudad, l.estado, l.barrio]] : [])]) {
      const k = `${l.operacion}/${l.tipo}/${ubicacion.join("/")}/${l.habitaciones}`;
      const e = set.get(k) ?? { operacion: l.operacion, tipo: l.tipo, ubicacion, habitaciones: l.habitaciones, total: 0 };
      e.total++;
      set.set(k, e);
    }
  }
  return [...set.values()].filter((f) => esIndexable(f.total));
}

export { slugify };

/** Precio por m² de una ficha. null si falta cualquiera de los dos datos. */
export const precioM2 = (l: Listing) =>
  l.precio !== null && l.m2 ? Math.round(l.precio / l.m2) : null;

const medianaDe = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;

/**
 * Mediana del precio/m² de la ciudad, para situar la ficha frente a su mercado.
 * Exige 5 muestras: con menos, la "mediana" es ruido y engañaría al comprador.
 */
export function medianaM2Ciudad(ciudad: string, operacion: Operacion): number | null {
  const xs = LISTINGS.filter((l) => l.ciudad === ciudad && l.operacion === operacion)
    .map(precioM2)
    .filter((v): v is number => v !== null);
  return xs.length >= 5 ? medianaDe(xs) : null;
}

/** Otros inmuebles del mismo perfil de Instagram. */
export function delMismoAnunciante(l: Listing, n = 3): { total: number; muestra: Listing[] } {
  if (!l.fuente.handle) return { total: 0, muestra: [] };
  const suyos = LISTINGS.filter((o) => o.fuente.handle === l.fuente.handle && o.publicId !== l.publicId);
  return { total: suyos.length, muestra: suyos.slice(0, n) };
}

export const cuantos = (f: Partial<Pick<Listing, "ciudad" | "estado" | "barrio" | "tipo" | "operacion">>) =>
  LISTINGS.filter((l) =>
    (!f.ciudad || l.ciudad === f.ciudad) && (!f.estado || l.estado === f.estado) &&
    (!f.barrio || l.barrio === f.barrio) &&
    (!f.tipo || l.tipo === f.tipo) && (!f.operacion || l.operacion === f.operacion)
  ).length;

/**
 * Combinaciones tipo × ciudad con mas inventario, para el footer.
 * Solo las que superan el umbral: enlazar a paginas en noindex desde las 1.744
 * paginas del sitio seria repartir autoridad hacia donde no compite.
 */
export function destacadosPorOperacion(operacion: Operacion, n = 6) {
  return combinacionesConInventario()
    .filter((c) => c.operacion === operacion && c.ubicacion.length === 2 && esIndexable(c.total))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
    .map((c) => {
      const ciudad = ciudadPorSlug.get(c.ubicacion[0]);
      return {
        href: rutaListado(c.operacion, c.tipo, c.ubicacion),
        label: `${TIPO_LABEL[c.tipo].plural} en ${ciudad?.nombre ?? c.ubicacion[0]}`,
        total: c.total,
      };
    });
}

/**
 * URL canónica de un listado.
 *
 * Hoy los 5 estados tienen una sola ciudad con inventario, asi que
 * /venta/apartamentos/lara y /venta/apartamentos/barquisimeto/lara muestran
 * EXACTAMENTE los mismos inmuebles: dos URLs compitiendo por la misma consulta.
 *
 * Cuando toda una combinacion vive en una sola ciudad, la pagina de estado apunta
 * su canonical a la de ciudad. Gana la ciudad porque es donde esta la demanda real
 * ("apartamentos en venta barquisimeto" tiene volumen; "lara" no).
 *
 * La pagina de estado sigue existiendo y enlazando: deja de competir, no de servir.
 * En cuanto entre inventario de una segunda ciudad, la condicion deja de cumplirse
 * sola y el estado recupera su canonical propia.
 */
export function canonicaListado(
  operacion: Operacion, tipo: Tipo, ubicacion: string[], pagina = 1, habitaciones?: number,
): string {
  const propia = rutaPagina(operacion, tipo, ubicacion, pagina, habitaciones);
  if (ubicacion.length !== 1) return propia;

  const ciudades = new Set(
    LISTINGS.filter((l) => l.operacion === operacion && l.tipo === tipo && l.estado === ubicacion[0])
      .map((l) => l.ciudad)
  );
  if (ciudades.size !== 1) return propia;
  return rutaPagina(operacion, tipo, [[...ciudades][0], ubicacion[0]], pagina, habitaciones);
}

/**
 * Enlace de un tipo hacia la ciudad donde SI tiene inventario.
 *
 * Apuntar todos los tipos a la ciudad principal generaba 404 (no hay anexos en
 * Caracas) y enlaces muertos que Google rastrea. Vive aqui porque lo necesitan la
 * Home, el footer y la 404: tres copias de esta regla es una copia que se olvida.
 */
export function enlaceTipo(tipo: Tipo, operacion: Operacion = "venta") {
  const suyos = LISTINGS.filter((l) => l.tipo === tipo && l.operacion === operacion);
  if (!suyos.length) return null;

  const porCiudad = new Map<string, number>();
  for (const l of suyos) porCiudad.set(l.ciudad, (porCiudad.get(l.ciudad) ?? 0) + 1);
  const mejor = [...porCiudad.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const ciudad = ciudadPorSlug.get(mejor);
  if (!ciudad) return null;

  return {
    tipo,
    href: rutaListado(operacion, tipo, [ciudad.slug, ciudad.estado]),
    label: TIPO_LABEL[tipo].plural,
    total: LISTINGS.filter((l) => l.tipo === tipo).length,
  };
}

/** Todos los tipos con inventario, ordenados por volumen. */
export const tiposConEnlace = (operacion: Operacion = "venta") =>
  [...new Set(LISTINGS.map((l) => l.tipo))]
    .map((t) => enlaceTipo(t, operacion))
    .filter((x): x is NonNullable<ReturnType<typeof enlaceTipo>> => x !== null)
    .sort((a, b) => b.total - a.total);
