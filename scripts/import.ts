/**
 * Construye data/listings.json + data/locations.json a partir de:
 *   data/raw/Inmuebles.json   (volcado fiel del Excel)
 *   data/extracted.json       (campos re-extraidos del caption)
 *   data/whatsapp.json        (perfil de Instagram -> numero)
 *
 * Cuando el Excel y el caption discrepan gana el caption: el Excel es un parseo
 * por reglas que demostrablemente falla (ver ROADMAP §8). El valor del Excel se
 * usa solo para rellenar lo que la extraccion dejo en null.
 *
 * Uso: npm run import
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  slugify, TIPO_LABEL,
  type Listing, type Tipo, type Operacion, type Estado, type Ciudad,
} from "../src/lib/types.ts";

const ROOT = join(import.meta.dirname, "..");
const D = (f: string) => join(ROOT, "data", f);
const read = (f: string) => JSON.parse(readFileSync(D(f), "utf8"));

/** Las 5 ciudades del piloto. El estado no viene en la data, se deriva de la ciudad. */
const ESTADO_POR_CIUDAD: Record<string, string> = {
  Caracas: "Distrito Capital",
  Maracaibo: "Zulia",
  Valencia: "Carabobo",
  Maracay: "Aragua",
  Barquisimeto: "Lara",
};

const TIPOS = new Set(Object.keys(TIPO_LABEL));

/** Venezuela: +58 y 10 digitos. Devuelve null si no es un movil valido. */
export function e164(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "").replace(/^58/, "").replace(/^0/, "");
  return /^4(12|14|16|24|26)\d{7}$/.test(d) ? `+58${d}` : null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

type Extraido = {
  id: string;
  ofertas?: unknown[];
  barrio?: unknown;
  tipo?: unknown;
  telefono?: string | null;
  m2?: unknown;
  habitaciones?: unknown;
  banos?: unknown;
  area_terreno?: unknown;
  estacionamientos?: unknown;
  amoblado?: unknown;
  amenidades?: unknown;
};

type CdnManifest = {
  imagesByShortcode?: Record<string, string[]>;
  videosByShortcode?: Record<string, string[]>;
};

/** El area a dos decimales es ruido de parseo: "371.06 m²" se lee peor que "371 m²". */
export const redondear = (v: number | null): number | null => (v === null ? null : Math.round(v));

/** Un mismo barrio llega como "LA CASTELLANA" y "La Castellana": mismo slug, nombre distinto. */
const MENORES = new Set(["de", "del", "la", "las", "los", "el", "y", "en", "a"]);
export function titleCase(s: string): string {
  return s.trim().toLowerCase().split(/\s+/)
    .map((w, i) =>
      /^[ivx]+$/.test(w) ? w.toUpperCase()                       // "II", "IV"
      : i > 0 && MENORES.has(w) ? w
      : w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Cuanta informacion util trae una ficha. Decide cual sobrevive al deduplicar. */
const riqueza = (l: Listing) =>
  (l.fotosCount + l.videosCount) * 10 +
  [l.precio, l.m2, l.habitaciones, l.banos, l.estacionamientos, l.areaTerreno, l.barrio].filter((v) => v !== null).length +
  l.amenidades.length +
  (l.descripcion?.length ?? 0) / 1000;

/**
 * El mismo inmueble se republica en Instagram varias veces con captions distintos.
 * Se agrupan por sus atributos y sobrevive la publicacion mas completa.
 * Guarda: solo agrupa si hay algo que distinga (precio o area); sin eso, dos fichas
 * escuetas del mismo tipo y barrio podrian ser inmuebles realmente distintos.
 */
export function deduplicar(listings: Listing[]): { unicas: Listing[]; retirados: number } {
  const grupos = new Map<string, Listing[]>();
  const sueltas: Listing[] = [];
  for (const l of listings) {
    if (l.precio === null && l.m2 === null) { sueltas.push(l); continue; }
    const k = [l.ciudad, l.tipo, l.operacion, l.precio, l.m2, l.habitaciones, l.banos, l.barrio].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  const unicas = [...grupos.values()].map((g) => g.sort((a, b) => riqueza(b) - riqueza(a))[0]);
  return { unicas: [...unicas, ...sueltas], retirados: listings.length - unicas.length - sueltas.length };
}

/** Descarta outliers de parseo: 39 habitaciones o 28 banos son errores, no inmuebles. */
const enRango = (v: number | null, max: number): number | null =>
  v !== null && v > 0 && v <= max ? v : null;

function main() {
  const raw = read("raw/Inmuebles.json") as Record<string, unknown>[];
  const extracted: Extraido[] = existsSync(D("extracted.json")) ? read("extracted.json") : [];
  const wa: Record<string, string | null> = existsSync(D("whatsapp.json")) ? read("whatsapp.json") : {};
  const cdn: CdnManifest = existsSync(D("cdn-images.json")) ? read("cdn-images.json") : {};
  const ex = new Map(extracted.map((e) => [e.id, e]));

  const listings: Listing[] = [];
  const stats = { avisos: 0, sinExtraer: 0, sinOperacion: 0, sinTipo: 0, dobles: 0 };

  for (const r of raw) {
    if (!r["Ciudad"]) continue; // las 3 filas fantasma
    const shortcode = /\/p\/([^/]+)\/?/.exec(r["URL del Post"] ?? "")?.[1];
    if (!shortcode) continue;
    stats.avisos++;

    const e = ex.get(shortcode);
    if (!e) { stats.sinExtraer++; continue; }

    // ofertas: normalmente una; dos cuando el aviso se vende Y se alquila
    const ofertas: { operacion: Operacion; precio: number | null }[] = (e.ofertas ?? []).flatMap((valor) => {
      if (!valor || typeof valor !== "object") return [];
      const oferta = valor as Record<string, unknown>;
      if (oferta.operacion !== "venta" && oferta.operacion !== "alquiler") return [];
      return [{ operacion: oferta.operacion, precio: num(oferta.precio) }];
    });
    if (!ofertas.length) { stats.sinOperacion++; continue; }
    if (ofertas.length > 1) stats.dobles++;

    const ciudadNombre = String(r["Ciudad"]).trim();
    const estadoNombre = ESTADO_POR_CIUDAD[ciudadNombre] ?? ciudadNombre;
    const ciudad = slugify(ciudadNombre);
    const estado = slugify(estadoNombre);

    // barrio: gana la extraccion; se descarta si repite la ciudad o parece una frase
    let barrioNombre: string | null = (e.barrio ?? "").toString().trim() || null;
    if (barrioNombre) barrioNombre = titleCase(barrioNombre);
    if (barrioNombre && (slugify(barrioNombre) === ciudad || barrioNombre.length > 40)) barrioNombre = null;
    const barrio = barrioNombre ? slugify(barrioNombre) : null;

    // sin tipo no hay listado al que pertenecer: seria una ficha huerfana sin enlaces internos
    if (typeof e.tipo !== "string" || !TIPOS.has(e.tipo)) { stats.sinTipo++; continue; }
    const tipo = e.tipo as Tipo;
    const descripcion = (r["Caption completo"] ?? "").toString().trim() || null;
    const handle = (r["Perfil IG"] ?? "").toString().trim() || null;
    const fotos = [...new Set(cdn.imagesByShortcode?.[shortcode] ?? [])];
    const videos = [...new Set(cdn.videosByShortcode?.[shortcode] ?? [])];
    const fotosCount = fotos.length;
    const videosCount = videos.length;
    const whatsapp = e164(e.telefono) ?? e164(handle ? wa[handle] ?? null : null);

    const m2 = redondear(num(e.m2) ?? num(r["M2"]));
    const habitaciones = enRango(num(e.habitaciones) ?? num(r["Habitaciones"]), 20);
    const banos = enRango(num(e.banos) ?? num(r["Baños"]), 20);

    for (const o of ofertas) {
      const precio = o.precio ?? null;
      const nombreTipo = TIPO_LABEL[tipo].singular;
      const donde = barrioNombre ?? ciudadNombre;

      listings.push({
        publicId: `${shortcode}-${o.operacion}`,
        slug: slugify(`${nombreTipo}-${o.operacion}-${donde}-${ciudadNombre}`),
        operacion: o.operacion,
        tipo,
        estado, estadoNombre, ciudad, ciudadNombre, barrio, barrioNombre,
        precio,
        titulo: `${nombreTipo} en ${o.operacion === "venta" ? "venta" : "alquiler"} en ${donde}`,
        descripcion,
        m2,
        areaTerreno: redondear(num(e.area_terreno)),
        habitaciones,
        banos,
        estacionamientos: enRango(num(e.estacionamientos), 50),
        amoblado: typeof e.amoblado === "boolean" ? e.amoblado : null,
        amenidades: Array.isArray(e.amenidades) ? e.amenidades.filter((a): a is string => typeof a === "string") : [],
        whatsapp,
        fotos,
        fotosCount,
        videos,
        videosCount,
        fuente: {
          handle,
          postUrl: texto(r["URL del Post URL"]) ?? texto(r["URL del Post"]),
          driveUrl: texto(r["Carpeta en Drive URL"]),
        },
        // §10.4: completo si hay precio y (habitaciones o area)
        dataQuality: precio !== null && (habitaciones !== null || m2 !== null) ? "completo" : "parcial",
        // ficha indexable: >=1 recurso visual y (precio o descripcion)
        indexable: fotos.length + videos.length >= 1 && (precio !== null || descripcion !== null),
      });
    }
  }

  const { unicas, retirados } = deduplicar(listings);

  // arbol geografico derivado de la data real: sin combinaciones vacias por construccion
  const estados = new Map<string, Estado>();
  for (const l of unicas) {
    const es = estados.get(l.estado) ?? { slug: l.estado, nombre: l.estadoNombre, total: 0, ciudades: [] };
    estados.set(l.estado, es);
    es.total++;
    let ci = es.ciudades.find((c) => c.slug === l.ciudad);
    if (!ci) {
      ci = { slug: l.ciudad, nombre: l.ciudadNombre, estado: l.estado, estadoNombre: l.estadoNombre, total: 0, barrios: [] } as Ciudad;
      es.ciudades.push(ci);
    }
    ci.total++;
    if (l.barrio && l.barrioNombre) {
      const b = ci.barrios.find((x) => x.slug === l.barrio);
      if (b) b.total++;
      else ci.barrios.push({ slug: l.barrio, nombre: l.barrioNombre, total: 1 });
    }
  }
  const tree = [...estados.values()].sort((a, b) => b.total - a.total);
  for (const e of tree) {
    e.ciudades.sort((a, b) => b.total - a.total);
    for (const c of e.ciudades) c.barrios.sort((a, b) => b.total - a.total);
  }

  writeFileSync(D("listings.json"), JSON.stringify(unicas, null, 2));
  writeFileSync(D("locations.json"), JSON.stringify(tree, null, 2));
  const conPrecio = unicas.filter((l) => l.precio !== null).length;
  const indexables = unicas.filter((l) => l.indexable).length;
  const sinWa = unicas.filter((l) => !l.whatsapp).length;
  console.log(
    `${stats.avisos} avisos -> ${unicas.length} fichas\n` +
    `  descartados: ${stats.sinExtraer} sin extraer, ${stats.sinOperacion} sin operacion, ${stats.sinTipo} sin tipo clasificable\n` +
    `  avisos con venta Y alquiler: ${stats.dobles}  |  republicaciones retiradas: ${retirados}\n` +
    `  con precio: ${conPrecio}/${unicas.length}  ` +
    `indexables: ${indexables}  sin whatsapp: ${sinWa}\n` +
    `  ${tree.length} estados, ${tree.reduce((n, e) => n + e.ciudades.length, 0)} ciudades, ` +
    `${tree.reduce((n, e) => n + e.ciudades.reduce((m, c) => m + c.barrios.length, 0), 0)} barrios`
  );
}

// solo corre al invocarlo directamente: check.ts importa los helpers sin disparar el import
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
