import Link from "next/link";
import { FAMILIA, formatPrecio, type Tipo, type Listing } from "@/lib/types";
import { LISTINGS, LOCATIONS, rutaListado, tiposConEnlace, medios } from "@/lib/data";
import { OG_BASE } from "@/lib/seo";
import { Grid, Chips, Seccion, Banda } from "@/components/ui";
import { TipoStrip } from "@/components/TipoStrip";
import { MapaHero } from "@/components/MapaHero";
import { IconPin, IconChevron } from "@/components/icons";

export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...OG_BASE, images: ["/api/og"] },
};

const mediana = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

/**
 * Los que mejor lucen en un grid: con precio, con datos y con galeria.
 * Ordenar solo por m² dejaba 7 de los 8 apartamentos destacados con una sola
 * foto; quien entraba desde la portada abria ficha tras ficha sin galeria.
 */
const destacados = (filtro: (l: Listing) => boolean, n = 8) =>
  LISTINGS.filter((l) => filtro(l) && l.precio !== null && l.habitaciones !== null)
    .sort((a, b) => medios(b) - medios(a) || (b.m2 ?? 0) - (a.m2 ?? 0))
    .slice(0, n);

/** Precio del m² por ciudad: contenido único que ningún competidor publica. */
function estadisticas() {
  return LOCATIONS.flatMap((e) => e.ciudades)
    .map((c) => {
      const ventas = LISTINGS.filter((l) => l.ciudad === c.slug && l.operacion === "venta" && l.precio !== null);
      const alquileres = LISTINGS.filter((l) => l.ciudad === c.slug && l.operacion === "alquiler" && l.precio !== null);
      return {
        ...c,
        venta: mediana(ventas.map((l) => l.precio!)),
        alquiler: mediana(alquileres.map((l) => l.precio!)),
        m2: mediana(ventas.filter((l) => l.m2).map((l) => Math.round(l.precio! / l.m2!))),
        nVenta: ventas.length,
      };
    })
    .filter((c) => c.nVenta >= 3)
    .sort((a, b) => (b.m2 ?? 0) - (a.m2 ?? 0));
}

/** Barrios con más inventario, cada uno enlazado a su combinación dominante. */
function zonasBuscadas(n = 16) {
  const g = new Map<string, { nombre: string; ciudad: string; estado: string; barrio: string; tipos: Tipo[]; total: number }>();
  for (const l of LISTINGS) {
    if (!l.barrio || l.operacion !== "venta") continue;
    const k = `${l.ciudad}:${l.barrio}`;
    const e = g.get(k) ?? { nombre: l.barrioNombre!, ciudad: l.ciudad, estado: l.estado, barrio: l.barrio, tipos: [], total: 0 };
    e.tipos.push(l.tipo);
    e.total++;
    g.set(k, e);
  }
  return [...g.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
    .map((z) => {
      const dominante = z.tipos.sort(
        (a, b) => z.tipos.filter((t) => t === b).length - z.tipos.filter((t) => t === a).length
      )[0];
      return { href: rutaListado("venta", dominante, [z.ciudad, z.estado, z.barrio]), label: z.nombre, count: z.total };
    });
}

export default function Home() {
  const ciudades = LOCATIONS.flatMap((e) => e.ciudades).sort((a, b) => b.total - a.total);
  const stats = estadisticas();

  const tipos = tiposConEnlace();

  const apartamentos = destacados((l) => l.tipo === "apartamento" && l.operacion === "venta");
  const casas = destacados((l) => l.tipo === "casa" && l.operacion === "venta");
  const comerciales = destacados((l) => FAMILIA[l.tipo] === "comercial", 4);
  // Estas dos tiras prometen orden por precio en su copy, asi que aqui la galeria
  // filtra en vez de reordenar: siguen siendo las mas baratas, pero las que se ven.
  const alquileres = LISTINGS.filter((l) => l.operacion === "alquiler" && l.precio !== null && medios(l) > 1)
    .sort((a, b) => a.precio! - b.precio!).slice(0, 8);
  const economicos = LISTINGS.filter((l) => l.operacion === "venta" && l.precio !== null && l.precio <= 50_000 && medios(l) > 1)
    .sort((a, b) => a.precio! - b.precio!).slice(0, 8);

  const faqs = [
    {
      // con una sola ciudad lanzada no hay rango que comparar
      q: `¿Cuánto cuesta el metro cuadrado en ${stats.length === 1 ? stats[0].nombre : "Venezuela"}?`,
      a: stats.length === 1 && stats[0].m2
        ? `Según los inmuebles en venta publicados, la mediana del metro cuadrado en ${stats[0].nombre} es de ${formatPrecio(stats[0].m2)}.`
        : stats.length > 1
        ? `Según los ${LISTINGS.filter((l) => l.operacion === "venta" && l.precio && l.m2).length} inmuebles en venta publicados, el metro cuadrado va de ${formatPrecio(stats.at(-1)!.m2)} en ${stats.at(-1)!.nombre} a ${formatPrecio(stats[0].m2)} en ${stats[0].nombre}.`
        : "Publicamos el precio por metro cuadrado calculado con el inventario real de cada ciudad.",
    },
    {
      q: "¿Se puede comprar un inmueble en Venezuela en dólares?",
      a: "Sí. Prácticamente todo el mercado inmobiliario venezolano opera al contado y en dólares. Todos los precios de este portal están expresados en USD.",
    },
    {
      q: "¿Cómo contacto al dueño o al agente?",
      a: "Cada ficha tiene un botón de WhatsApp que abre la conversación directamente con quien publica el inmueble, con el enlace de la propiedad ya escrito en el mensaje.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />

      {/* HERO: el mapa a sangre completa. El panel va DENTRO del mapa para que se
          aparte solo cuando el usuario selecciona un inmueble o dibuja una zona.
          En movil es texto llano encima del mapa; la tarjeta flotante es de sm+. */}
      <section className="relative">
        <MapaHero>
          <div className="sm:rounded-card sm:border sm:border-borde sm:bg-papel/95 sm:p-5 sm:shadow-[var(--shadow-pill)] sm:backdrop-blur-sm">
            <h1 className="text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">
              Portal inmobiliario de Venezuela: apartamentos y casas en venta y alquiler
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-tinta-2">
              {LISTINGS.length.toLocaleString("es-VE")} inmuebles en{" "}
              {ciudades.length === 1 ? ciudades[0].nombre : `${ciudades.length} ciudades`}, con precios
              en dólares y contacto directo por WhatsApp.{" "}
              <span className="text-tinta">Dibuja tu zona en el mapa</span> para ver solo lo que hay ahí.
            </p>
          </div>
        </MapaHero>
      </section>

      <TipoStrip items={tipos} />

      <div className="mx-auto max-w-7xl px-5 py-10">
        {/* precio del m2: contenido propio, no un listado mas.
            Las secciones que comparan ciudades solo salen con 2 o mas lanzadas. */}
        {stats.length > 1 && (
          <section>
            <h2 className="text-xl font-extrabold tracking-[-0.02em]">Precio del metro cuadrado por ciudad</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-tinta-2">
              Mediana calculada con los inmuebles en venta publicados hoy. Se actualiza con el inventario.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {stats.map((c) => (
                <Link key={c.slug} href={rutaListado("venta", "apartamento", [c.slug, c.estado])}
                  className="rounded-card border border-borde p-4 transition-colors hover:border-tinta hover:bg-humo">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <IconPin size={15} className="text-tinta-3" />{c.nombre}
                  </p>
                  <p className="tabular mt-2 text-lg font-bold text-ambar">
                    {c.m2 ? `US$ ${c.m2.toLocaleString("es-VE")}` : "Sin dato"}
                    <span className="text-xs font-normal text-tinta-2"> /m²</span>
                  </p>
                  <p className="tabular mt-1 text-xs text-tinta-2">Mediana venta {formatPrecio(c.venta)}</p>
                  {c.alquiler && (
                    <p className="tabular text-xs text-mar">Alquiler {formatPrecio(c.alquiler)}/mes</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {apartamentos.length > 0 && (
          <Seccion titulo="Apartamentos en venta destacados">
            <Grid listings={apartamentos} />
          </Seccion>
        )}
      </div>

      <Banda tono="crema">
        <h2 className="text-xl font-extrabold tracking-[-0.02em]">Las zonas con más oferta</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-tinta-2">
          Las urbanizaciones donde hoy hay más inmuebles publicados.
        </p>
        <div className="mt-5"><Chips items={zonasBuscadas()} /></div>
      </Banda>

      <div className="mx-auto max-w-7xl px-5">
        {casas.length > 0 && (
          <Seccion titulo="Casas en venta destacadas">
            <Grid listings={casas} />
          </Seccion>
        )}
      </div>

      <Banda tono="menta">
        <h2 className="text-xl font-extrabold tracking-[-0.02em]">
          En alquiler, desde {formatPrecio(alquileres[0]?.precio ?? null)} al mes
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-tinta-2">
          {LISTINGS.filter((l) => l.operacion === "alquiler").length} inmuebles en alquiler, ordenados por precio.
        </p>
        <div className="mt-5"><Grid listings={alquileres} /></div>
      </Banda>

      <div className="mx-auto max-w-7xl px-5">
        {economicos.length > 0 && (
          <Seccion titulo="Por menos de US$ 50.000">
            <Grid listings={economicos} />
          </Seccion>
        )}

        {comerciales.length > 0 && (
          <Seccion titulo="Oficinas, locales y galpones">
            <Grid listings={comerciales} />
          </Seccion>
        )}

        {ciudades.length > 1 && <Seccion titulo="Busca por ciudad">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ciudades.map((c) => (
              <Link key={c.slug} href={rutaListado("venta", "apartamento", [c.slug, c.estado])}
                className="group flex items-center justify-between gap-2 rounded-card border border-borde px-4 py-3.5 transition-colors hover:border-tinta hover:bg-humo">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <IconPin size={16} className="shrink-0 text-acento" />
                    <span className="truncate">{c.nombre}</span>
                  </span>
                  <span className="tabular mt-0.5 block text-sm text-tinta-2">{c.total} inmuebles</span>
                </span>
                <IconChevron size={16} className="shrink-0 text-tinta-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </Seccion>}

        {LOCATIONS.length > 1 && <Seccion titulo="Explora por estado">
          <Chips items={LOCATIONS.map((e) => ({
            href: rutaListado("venta", "apartamento", [e.slug]), label: e.nombre, count: e.total,
          }))} />
        </Seccion>}

        <Seccion titulo="Explora por tipo de inmueble">
          <Chips items={tipos.map((t) => ({ href: t.href, label: t.label, count: t.total }))} />
        </Seccion>

        <Seccion titulo="Preguntas frecuentes">
          <dl className="max-w-3xl divide-y divide-borde border-y border-borde">
            {faqs.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="font-medium"><h3>{f.q}</h3></dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-tinta-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Seccion>
      </div>

    </>
  );
}
