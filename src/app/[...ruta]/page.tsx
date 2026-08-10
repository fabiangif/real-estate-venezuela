import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TIPO_LABEL, OPERACION_LABEL, formatPrecio } from "@/lib/types";
import { byId, tipoPorSlug, combinacionesConInventario, facetasConInventario, rutaFicha, canonicaListado, POR_PAGINA, LISTINGS, esIndexable } from "@/lib/data";
import { OG_BASE } from "@/lib/seo";
import Listado, { parseListado, tituloListado } from "./listado";
import Ficha from "./ficha";

/**
 * Un unico catch-all sirve toda la taxonomia pSEO. Next no admite dos segmentos
 * dinamicos con nombres distintos en la misma posicion, asi que el despacho se hace
 * por numero de segmentos y asi se conservan las URLs exactas del documento:
 *   2 segmentos      -> ficha    /apartamento-venta-del-este-barquisimeto/AbC123-venta
 *   3 a 5 segmentos  -> listado  /venta/apartamentos/barquisimeto/lara/del-este
 */
function resolver(seg: string[]) {
  if (seg.length === 2) {
    const l = byId.get(seg[1]);
    return l && l.slug === seg[0] ? ({ kind: "ficha", l } as const) : null;
  }
  const c = parseListado(seg, tipoPorSlug);
  return c ? ({ kind: "listado", c } as const) : null;
}

export const dynamicParams = false; // solo existen las combinaciones con inventario

export function generateStaticParams() {
  return [
    ...LISTINGS.map((l) => ({ ruta: [l.slug, l.publicId] })),
    // una entrada por combinacion y por faceta, mas una por cada pagina extra
    ...[
      ...combinacionesConInventario().map((c) => ({ ...c, sufijo: [] as string[] })),
      ...facetasConInventario().map((f) => ({ ...f, sufijo: [`${f.habitaciones}-habitaciones`] })),
    ].flatMap((c) => {
      const base = [c.operacion, TIPO_LABEL[c.tipo].slug, ...c.ubicacion, ...c.sufijo];
      const paginas = Math.ceil(c.total / POR_PAGINA);
      return [
        { ruta: base },
        ...Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => ({
          ruta: [...base, "pagina", String(i + 2)],
        })),
      ];
    }),
  ];
}

export async function generateMetadata({ params }: PageProps<"/[...ruta]">): Promise<Metadata> {
  const { ruta } = await params;
  const r = resolver(ruta);
  if (!r) return {};

  if (r.kind === "ficha") {
    const { l } = r;
    const donde = `${l.barrioNombre ? `${l.barrioNombre}, ` : ""}${l.ciudadNombre}`;
    const tipo = TIPO_LABEL[l.tipo].singular;
    return {
      title: `${tipo} en ${OPERACION_LABEL[l.operacion]} en ${donde} — ${formatPrecio(l.precio)}`,
      description: (l.descripcion ?? l.titulo).replace(/\s+/g, " ").slice(0, 155),
      alternates: { canonical: rutaFicha(l) },
      openGraph: { ...OG_BASE, images: [`/api/og?id=${encodeURIComponent(l.publicId)}`] },
      // §10.4: sin foto, o sin precio ni descripcion, no compite en el indice
      robots: l.indexable ? undefined : { index: false, follow: true },
    };
  }

  const { c } = r;
  const n = c.todos.length;
  return {
    title: `${tituloListado(c)} — ${n} ${n === 1 ? "inmueble" : "inmuebles"}`,
    description: `${n} ${TIPO_LABEL[c.tipo].plural.toLowerCase()} en ${c.operacion === "venta" ? "venta" : "alquiler"} en ${c.lugar}. Precios en USD y contacto directo por WhatsApp.`,
    alternates: { canonical: canonicaListado(c.operacion, c.tipo, c.ubicacion, c.pagina, c.habitaciones) },
    openGraph: { ...OG_BASE, images: [`/api/og?l=${encodeURIComponent(ruta.join("/"))}`] },
    robots: esIndexable(n) ? undefined : { index: false, follow: true },
  };
}

export default async function Page({ params }: PageProps<"/[...ruta]">) {
  const { ruta } = await params;
  const r = resolver(ruta);
  if (!r) notFound();
  return r.kind === "ficha" ? <Ficha l={r.l} /> : <Listado c={r.c} />;
}
