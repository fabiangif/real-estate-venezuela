import Image from "next/image";
import Link from "next/link";
import { FAMILIA, formatPrecio, type Tipo, type Listing } from "@/lib/types";
import { LISTINGS, LOCATIONS, rutaListado, tiposConEnlace } from "@/lib/data";
import { OG_BASE } from "@/lib/seo";
import { LOCATION_IMAGES } from "@/lib/location-images";
import { Grid, Chips, Seccion, Banda } from "@/components/ui";
import { TipoStrip } from "@/components/TipoStrip";
import { PhotoCredits } from "@/components/LocationHero";
import { IconPin, IconChevron } from "@/components/icons";

const CITY_MOSAIC_CLASSES = [
  "col-span-4 row-span-2",
  "col-span-2",
  "col-span-2",
  "col-span-3",
  "col-span-3",
];

export const metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...OG_BASE, images: ["/api/og"] },
};

const mediana = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

/** Los que mejor lucen en un grid: con precio y con datos. */
const destacados = (filtro: (l: Listing) => boolean, n = 8) =>
  LISTINGS.filter((l) => filtro(l) && l.precio !== null && l.habitaciones !== null)
    .sort((a, b) => (b.m2 ?? 0) - (a.m2 ?? 0))
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
  const principal = ciudades[0];
  const barrios = ciudades.reduce((total, ciudad) => total + ciudad.barrios.length, 0);
  const stats = estadisticas();

  const tipos = tiposConEnlace();
  const alquilerPopular = tiposConEnlace("alquiler")[0];

  const apartamentos = destacados((l) => l.tipo === "apartamento" && l.operacion === "venta");
  const casas = destacados((l) => l.tipo === "casa" && l.operacion === "venta");
  const comerciales = destacados((l) => FAMILIA[l.tipo] === "comercial", 4);
  const alquileres = LISTINGS.filter((l) => l.operacion === "alquiler" && l.precio !== null)
    .sort((a, b) => a.precio! - b.precio!).slice(0, 8);
  const economicos = LISTINGS.filter((l) => l.operacion === "venta" && l.precio !== null && l.precio <= 50_000)
    .sort((a, b) => a.precio! - b.precio!).slice(0, 8);

  const faqs = [
    {
      q: "¿Cuánto cuesta el metro cuadrado en Venezuela?",
      a: stats.length
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
    {
      q: "¿Publicar un inmueble tiene costo?",
      a: "No. La publicación es gratuita para propietarios, agentes e inmobiliarias.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />

      <section className="border-b border-borde-suave bg-crema">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,.95fr)] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold text-acento">Inmuebles en toda Venezuela</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              Apartamentos y casas en venta y alquiler, en una sola búsqueda
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-tinta-2 sm:text-lg">
              Busca desde la barra superior por ciudad, urbanización, tipo de inmueble,
              habitaciones o características como piscina, planta eléctrica y vigilancia.
              Todos los precios están en dólares y el contacto es directo por WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href={rutaListado("venta", "apartamento", [principal.slug, principal.estado])}
                className="rounded-full border border-borde bg-papel px-4 py-2 text-sm font-medium transition-colors hover:border-tinta hover:bg-humo"
              >
                Apartamentos en {principal.nombre}
              </Link>
              {alquilerPopular && (
                <Link
                  href={alquilerPopular.href}
                  className="rounded-full border border-borde bg-papel px-4 py-2 text-sm font-medium transition-colors hover:border-tinta hover:bg-humo"
                >
                  Explorar alquileres
                </Link>
              )}
            </div>
            <dl className="mt-8 grid max-w-xl grid-cols-3 divide-x divide-borde border-y border-borde py-4">
              {[
                { k: "Inmuebles", v: LISTINGS.length.toLocaleString("es-VE"), c: "text-acento" },
                { k: "Ciudades", v: String(ciudades.length), c: "text-mar" },
                { k: "Zonas", v: String(barrios), c: "text-ambar" },
              ].map((dato) => (
                <div key={dato.k} className="px-2 text-center first:pl-0 sm:px-4">
                  <dt className="text-xs text-tinta-2">{dato.k}</dt>
                  <dd className={`tabular mt-1 text-xl font-bold ${dato.c}`}>{dato.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <div className="grid h-80 grid-cols-6 grid-rows-3 gap-2 sm:h-96">
              {ciudades.slice(0, 5).map((ciudad, index) => {
                const image = LOCATION_IMAGES[ciudad.slug];
                if (!image) return null;

                const sizes = index === 0
                  ? "(max-width: 1023px) 66vw, 32vw"
                  : index < 3
                    ? "(max-width: 1023px) 33vw, 16vw"
                    : "(max-width: 1023px) 50vw, 24vw";

                return (
                  <Link
                    key={ciudad.slug}
                    href={rutaListado("venta", "apartamento", [ciudad.slug, ciudad.estado])}
                    aria-label={`Ver ${ciudad.total} inmuebles en ${ciudad.nombre}`}
                    className={`group relative overflow-hidden rounded-card bg-tinta ${CITY_MOSAIC_CLASSES[index]}`}
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes={sizes}
                      preload={index === 0}
                      style={{ objectPosition: image.objectPosition }}
                      className="object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <span className="block text-sm font-semibold leading-tight sm:text-base">{ciudad.nombre}</span>
                      <span className="tabular mt-0.5 block text-[11px] text-white/80 sm:text-xs">
                        {ciudad.total} inmuebles
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <PhotoCredits images={ciudades.slice(0, 5).flatMap((ciudad) => {
              const image = LOCATION_IMAGES[ciudad.slug];
              return image ? [image] : [];
            })} />
          </div>
        </div>
      </section>

      <TipoStrip items={tipos} />

      <div className="mx-auto max-w-7xl px-5 py-10">
        {/* precio del m2: contenido propio, no un listado mas */}
        {stats.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold tracking-[-0.01em]">Precio del metro cuadrado por ciudad</h2>
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
                    {c.m2 ? `US$ ${c.m2.toLocaleString("es-VE")}` : "—"}
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
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Las zonas con más oferta</h2>
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
        <h2 className="text-xl font-semibold tracking-[-0.01em]">
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

        <Seccion titulo="Busca por ciudad">
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
        </Seccion>

        <Seccion titulo="Explora por estado">
          <Chips items={LOCATIONS.map((e) => ({
            href: rutaListado("venta", "apartamento", [e.slug]), label: e.nombre, count: e.total,
          }))} />
        </Seccion>

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
