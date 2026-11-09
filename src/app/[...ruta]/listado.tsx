import Link from "next/link";
import { formatPrecio, TIPO_LABEL, OPERACION_LABEL, type Listing, type Operacion, type Tipo } from "@/lib/types";
import { buscar, resolveUbicacion, rutaListado, rutaPagina, esIndexable, UMBRAL_LISTADO, POR_PAGINA, MAX_FACETA_HAB, LISTINGS } from "@/lib/data";
import { Grid, Chips, Seccion } from "@/components/ui";
import { TipoStrip } from "@/components/TipoStrip";
import { LocationHero } from "@/components/LocationHero";
import { locationImage } from "@/lib/location-images";

export type Ctx = {
  operacion: Operacion; tipo: Tipo; ubicacion: string[];
  lugar: string; ciudadSlug?: string; estadoSlug: string; barrioSlug?: string;
  /** Todo el inventario de la combinacion: manda en cifras, intro, FAQ y umbral. */
  todos: Listing[];
  /** Solo el tramo que se pinta en esta pagina. */
  listings: Listing[];
  pagina: number;
  totalPaginas: number;
  /** Faceta indexable activa, si la hay. */
  habitaciones?: number;
};

/**
 * Resuelve /[operacion]/[tipo]/[...ubicacion][/pagina/N]. null => 404.
 *
 * Se parsea DESDE EL FINAL: asi /venta/apartamentos/lara/pagina/2 (5 segmentos) no se
 * confunde con /venta/apartamentos/barquisimeto/lara/del-este, que tambien son 5.
 */
export function parseListado(seg: string[], tipoPorSlug: Map<string, Tipo>): Ctx | null {
  let pagina = 1;
  if (seg.length >= 2 && seg.at(-2) === "pagina" && /^\d+$/.test(seg.at(-1)!)) {
    pagina = Number(seg.at(-1));
    if (pagina < 2) return null; // /pagina/1 duplicaria la URL base
    seg = seg.slice(0, -2);
  }

  // la faceta va justo antes de la paginacion: /…/3-habitaciones/pagina/2
  let habitaciones: number | undefined;
  const faceta = /^(\d+)-habitaciones$/.exec(seg.at(-1) ?? "");
  if (faceta) {
    habitaciones = Number(faceta[1]);
    if (habitaciones < 1 || habitaciones > MAX_FACETA_HAB) return null;
    seg = seg.slice(0, -1);
  }

  const [op, tipoSlug, ...ubicacion] = seg;
  if (op !== "venta" && op !== "alquiler") return null;
  const tipo = tipoPorSlug.get(tipoSlug);
  if (!tipo || !ubicacion.length || ubicacion.length > 3) return null;
  const u = resolveUbicacion(ubicacion);
  if (!u) return null;

  const todos = buscar({ operacion: op, tipo, estado: u.estado.slug, ciudad: u.ciudad?.slug, barrio: u.barrioSlug, habitaciones });
  const totalPaginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  if (pagina > totalPaginas) return null; // paginas vacias no existen

  return {
    operacion: op, tipo, ubicacion,
    lugar: u.barrioNombre ?? u.ciudad?.nombre ?? u.estado.nombre,
    estadoSlug: u.estado.slug, ciudadSlug: u.ciudad?.slug, barrioSlug: u.barrioSlug,
    todos,
    listings: todos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    pagina, totalPaginas, habitaciones,
  };
}

export function tituloListado(c: Ctx) {
  const base = c.habitaciones
    ? `${TIPO_LABEL[c.tipo].plural} de ${c.habitaciones} ${c.habitaciones === 1 ? "habitación" : "habitaciones"} en ${OPERACION_LABEL[c.operacion]} en ${c.lugar}`
    : `${TIPO_LABEL[c.tipo].plural} en ${OPERACION_LABEL[c.operacion]} en ${c.lugar}`;
  // sin esto, las paginas 2+ competirian con la 1 por el mismo title
  return c.pagina > 1 ? `${base}, página ${c.pagina}` : base;
}

/** Párrafo único por ubicación, construido con los datos reales del inventario. */
function intro(c: Ctx) {
  const n = c.todos.length;
  const precios = c.todos.map((l) => l.precio).filter((p): p is number => p !== null).sort((a, b) => a - b);
  const tipoTxt = TIPO_LABEL[c.tipo].plural.toLowerCase();
  const opTxt = c.operacion === "venta" ? "en venta" : "en alquiler";

  const rango = precios.length >= 2
    ? ` Los precios van desde ${formatPrecio(precios[0])} hasta ${formatPrecio(precios[precios.length - 1])}, con una mediana de ${formatPrecio(precios[Math.floor(precios.length / 2)])}.`
    : precios.length === 1 ? ` El precio publicado es de ${formatPrecio(precios[0])}.` : "";

  const areas = c.todos.map((l) => l.m2).filter((m): m is number => m !== null);
  const area = areas.length >= 3
    ? ` El área construida promedio ronda los ${Math.round(areas.reduce((a, b) => a + b, 0) / areas.length)} m².`
    : "";

  const hab = c.todos.map((l) => l.habitaciones).filter((h): h is number => h !== null);
  const habTxt = hab.length >= 3
    ? ` La mayoría tiene ${mediana(hab)} habitaciones.`
    : "";

  return `Encuentra ${n} ${tipoTxt} ${opTxt} en ${c.lugar}.${rango}${area}${habTxt} Contacta directamente por WhatsApp con el agente que publica cada inmueble.`;
}

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Cifras propias de esta ubicación: es lo que hace que dos listados no se lean igual. */
function cifras(c: Ctx) {
  const precios = c.todos.map((l) => l.precio).filter((p): p is number => p !== null);
  const areas = c.todos.map((l) => l.m2).filter((m): m is number => m !== null);
  const porM2 = c.todos.filter((l) => l.precio && l.m2).map((l) => Math.round(l.precio! / l.m2!));
  const hab = c.todos.map((l) => l.habitaciones).filter((h): h is number => h !== null);

  return [
    precios.length >= 3 && { k: "Precio mediano", v: formatPrecio(mediana(precios)), color: "text-acento" },
    porM2.length >= 3 && { k: "Precio por m²", v: `US$ ${mediana(porM2).toLocaleString("es-VE")}`, color: "text-ambar" },
    areas.length >= 3 && { k: "Área típica", v: `${mediana(areas)} m²`, color: "text-mar" },
    hab.length >= 3 && { k: "Habitaciones", v: String(mediana(hab)), color: "text-tinta" },
  ].filter(Boolean) as { k: string; v: string; color: string }[];
}

function faqs(c: Ctx) {
  const precios = c.todos.map((l) => l.precio).filter((p): p is number => p !== null);
  const tipoS = TIPO_LABEL[c.tipo].singular.toLowerCase();
  const zonas = [...new Set(c.todos.map((l) => l.barrioNombre).filter(Boolean))].slice(0, 5);

  return [
    {
      q: `¿Cuánto cuesta un ${tipoS} en ${c.lugar}?`,
      a: precios.length
        ? `Según los ${precios.length} inmuebles publicados actualmente, el precio mediano de un ${tipoS} ${c.operacion === "venta" ? "en venta" : "en alquiler"} en ${c.lugar} es de ${formatPrecio(mediana(precios))}, en un rango que va de ${formatPrecio(Math.min(...precios))} a ${formatPrecio(Math.max(...precios))}.`
        : `Todavía no hay precios publicados para ${tipoS} en ${c.lugar}. Contacta a los anunciantes para consultar disponibilidad y valores.`,
    },
    {
      q: `¿Cuáles son las mejores zonas de ${c.lugar}?`,
      a: zonas.length
        ? `Las zonas con más oferta de ${TIPO_LABEL[c.tipo].plural.toLowerCase()} en ${c.lugar} son ${zonas.join(", ")}. Cada una tiene su propio perfil de precio y servicios.`
        : `La oferta en ${c.lugar} está distribuida en distintas urbanizaciones. Revisa el listado completo para ver las zonas disponibles.`,
    },
  ];
}

/**
 * Paginacion con enlaces reales para que Google la rastree y el teclado la recorra.
 * Se muestran los vecinos de la actual, con la primera y la ultima siempre visibles.
 */
function Paginacion({ c }: { c: Ctx }) {
  if (c.totalPaginas <= 1) return null;
  const ruta = (n: number) => rutaPagina(c.operacion, c.tipo, c.ubicacion, n, c.habitaciones);

  const cerca = [1, c.totalPaginas, c.pagina, c.pagina - 1, c.pagina + 1]
    .filter((n) => n >= 1 && n <= c.totalPaginas);
  const paginas = [...new Set(cerca)].sort((a, b) => a - b);

  const estilo = "grid h-11 min-w-11 place-content-center rounded-full px-3.5 text-sm font-medium transition-colors";

  return (
    <nav aria-label="Paginación" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {c.pagina > 1 && (
        <Link href={ruta(c.pagina - 1)} rel="prev" className={`${estilo} border border-borde hover:bg-humo`}>
          Anterior
        </Link>
      )}

      {paginas.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n > paginas[i - 1] + 1 && <span className="text-tinta-3">…</span>}
          {n === c.pagina ? (
            <span aria-current="page" className={`${estilo} tabular bg-tinta font-semibold text-white`}>{n}</span>
          ) : (
            <Link href={ruta(n)} className={`${estilo} tabular border border-borde hover:bg-humo`}>{n}</Link>
          )}
        </span>
      ))}

      {c.pagina < c.totalPaginas && (
        <Link href={ruta(c.pagina + 1)} rel="next" className={`${estilo} border border-borde hover:bg-humo`}>
          Siguiente
        </Link>
      )}
    </nav>
  );
}

export default function Listado({ c }: { c: Ctx }) {
  const n = c.todos.length;
  const h1 = tituloListado(c);
  const heroImage = locationImage(c.ciudadSlug, c.estadoSlug);
  const indicadores = cifras(c);

  // interlinking: barrios de la misma ciudad, otros tipos, operacion opuesta
  const chipsBarrio = c.ciudadSlug
    ? [...new Map(
        LISTINGS.filter((l) => l.ciudad === c.ciudadSlug && l.tipo === c.tipo && l.operacion === c.operacion && l.barrio)
          .map((l) => [l.barrio!, l])
      ).entries()]
        .map(([slug, l]) => ({
          href: rutaListado(c.operacion, c.tipo, [c.ciudadSlug!, c.estadoSlug, slug]),
          label: l.barrioNombre!,
          count: LISTINGS.filter((x) => x.barrio === slug && x.tipo === c.tipo && x.operacion === c.operacion).length,
        }))
        .filter((x) => x.label !== c.lugar)
        .sort((a, b) => b.count - a.count)
        .slice(0, 14)
    : [];

  const chipsTipo = [...new Set(LISTINGS.filter((l) =>
    l.estado === c.estadoSlug && (!c.ciudadSlug || l.ciudad === c.ciudadSlug) && l.operacion === c.operacion && l.tipo && l.tipo !== c.tipo
  ).map((l) => l.tipo!))]
    .map((t) => ({ href: rutaListado(c.operacion, t, c.ubicacion), label: `${TIPO_LABEL[t].plural} en ${c.lugar}` }));

  const opuesta: Operacion = c.operacion === "venta" ? "alquiler" : "venta";
  const preguntas = faqs(c);

  // filtro de habitaciones: solo se ofrecen las que superan el umbral, para no
  // enviar al usuario (ni a Google) a una página que nacería en noindex
  const enCombinacion = LISTINGS.filter(
    (l) => l.operacion === c.operacion && l.tipo === c.tipo && l.estado === c.estadoSlug &&
      (!c.ciudadSlug || l.ciudad === c.ciudadSlug) && (!c.barrioSlug || l.barrio === c.barrioSlug)
  );
  const facetasHab = Array.from({ length: MAX_FACETA_HAB }, (_, i) => i + 1)
    .map((h) => ({ h, total: enCombinacion.filter((l) => l.habitaciones === h).length }))
    .filter((x) => esIndexable(x.total));

  // tira de categorías: los tipos que existen en esta misma ubicación y operación
  const enUbicacion = LISTINGS.filter(
    (l) => l.operacion === c.operacion && l.estado === c.estadoSlug &&
      (!c.ciudadSlug || l.ciudad === c.ciudadSlug) && (!c.barrioSlug || l.barrio === c.barrioSlug)
  );
  const tiposStrip = [...new Set(enUbicacion.map((l) => l.tipo))]
    .map((t) => ({ tipo: t, href: rutaListado(c.operacion, t, c.ubicacion), total: enUbicacion.filter((l) => l.tipo === t).length }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: "/" },
            { "@type": "ListItem", position: 2, name: c.lugar, item: rutaListado(c.operacion, c.tipo, c.ubicacion) },
          ],
        },
        {
          "@context": "https://schema.org", "@type": "ItemList", name: h1, numberOfItems: n,
          itemListElement: c.listings.slice(0, 20).map((l, i) => ({
            "@type": "ListItem", position: i + 1, name: l.titulo, url: `/${l.slug}/${l.publicId}`,
          })),
        },
        {
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: preguntas.map((f) => ({
            "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ]) }} />

      <TipoStrip items={tiposStrip} activo={c.tipo} />

      {heroImage && (
        <LocationHero image={heroImage}>
          <nav aria-label="Ruta" className="text-sm text-white/75">
            <Link href="/" className="hover:text-white hover:underline">Inicio</Link>
            <span className="mx-1.5 text-white/45">›</span>
            <span className="text-white">{c.lugar}</span>
          </nav>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Mercado inmobiliario · {heroImage.city}
          </p>
          <h1 className="mt-2 max-w-4xl text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl">
            {h1}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">{intro(c)}</p>

          {indicadores.length > 0 && (
            <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
              {indicadores.map((s) => (
                <div key={s.k} className="rounded-card border border-white/20 bg-black/25 px-4 py-3 backdrop-blur-sm">
                  <dt className="text-xs text-white/65">{s.k}</dt>
                  <dd className="tabular mt-0.5 text-lg font-bold text-white">{s.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </LocationHero>
      )}

      <div className="mx-auto max-w-7xl px-5 py-8">
        {!heroImage && (
          <>
            <nav aria-label="Ruta" className="text-sm text-tinta-2">
              <Link href="/" className="hover:text-tinta hover:underline">Inicio</Link>
              <span className="mx-1.5 text-tinta-3">›</span>
              <span className="text-tinta">{c.lugar}</span>
            </nav>

            <h1 className="mt-3 max-w-3xl text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">{h1}</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-tinta-2">{intro(c)}</p>

            {indicadores.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl">
                {indicadores.map((s) => (
                  <div key={s.k} className="rounded-card bg-crema px-4 py-3">
                    <dt className="text-xs text-tinta-2">{s.k}</dt>
                    <dd className={`tabular mt-0.5 text-lg font-bold ${s.color}`}>{s.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}

        {facetasHab.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-tinta-2">Habitaciones:</span>
            <Link href={rutaPagina(c.operacion, c.tipo, c.ubicacion)}
              aria-current={c.habitaciones ? undefined : "page"}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                c.habitaciones ? "border-borde hover:bg-humo" : "border-tinta bg-tinta text-white"
              }`}>
              Todas
            </Link>
            {facetasHab.map(({ h, total }) => {
              const activa = c.habitaciones === h;
              return (
                <Link key={h} href={rutaPagina(c.operacion, c.tipo, c.ubicacion, 1, h)}
                  aria-current={activa ? "page" : undefined}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    activa ? "border-tinta bg-tinta text-white" : "border-borde hover:bg-humo"
                  }`}>
                  {h}
                  <span className={`tabular ml-1 text-xs ${activa ? "text-white/70" : "text-tinta-3"}`}>{total}</span>
                </Link>
              );
            })}
          </div>
        )}

        <Seccion titulo={`${n} ${n === 1 ? "inmueble" : "inmuebles"} en ${c.lugar}`}>
          {c.totalPaginas > 1 && (
            <p className="tabular -mt-2 mb-5 text-sm text-tinta-2">
              Mostrando {(c.pagina - 1) * POR_PAGINA + 1}–{Math.min(c.pagina * POR_PAGINA, n)} de {n}
              {" · "}página {c.pagina} de {c.totalPaginas}
            </p>
          )}
          {n > 0 ? <><Grid listings={c.listings} /><Paginacion c={c} /></> : (
            <p className="rounded-card border border-borde px-5 py-10 text-center text-tinta-2">
              Todavía no hay inmuebles publicados en esta combinación.
            </p>
          )}
        </Seccion>

        {chipsBarrio.length > 0 && (
          <Seccion titulo={`${TIPO_LABEL[c.tipo].plural} por zona en ${c.lugar}`}>
            <Chips items={chipsBarrio} />
          </Seccion>
        )}

        {chipsTipo.length > 0 && (
          <Seccion titulo={`Otros tipos de inmueble en ${c.lugar}`}>
            <Chips items={chipsTipo} />
          </Seccion>
        )}

        <Seccion titulo={`${TIPO_LABEL[c.tipo].plural} en ${OPERACION_LABEL[opuesta].toLowerCase()}`}>
          <Chips items={[{
            href: rutaListado(opuesta, c.tipo, c.ubicacion),
            label: `${TIPO_LABEL[c.tipo].plural} en ${OPERACION_LABEL[opuesta].toLowerCase()} en ${c.lugar}`,
          }]} />
        </Seccion>

        <Seccion titulo="Preguntas frecuentes">
          <dl className="max-w-2xl divide-y divide-borde border-y border-borde">
            {preguntas.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="text-base font-medium"><h3>{f.q}</h3></dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-tinta-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Seccion>

        {!esIndexable(n) && (
          <p className="mt-10 text-xs text-tinta-3">
            Esta página tiene menos de {UMBRAL_LISTADO} inmuebles y no se indexa en buscadores.
          </p>
        )}
      </div>
    </>
  );
}
