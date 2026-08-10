import Link from "next/link";
import { formatPrecio, TIPO_LABEL, OPERACION_LABEL, type Listing } from "@/lib/types";
import { similares, rutaListado, rutaFicha, precioM2, medianaM2Ciudad, delMismoAnunciante, cuantos } from "@/lib/data";
import { Foto, Grid, Seccion, MiniFila } from "@/components/ui";
import { IconBed, IconBath, IconArea, IconCar, IconCheck, IconPin, IconWhatsapp, IconChevron } from "@/components/icons";

import { SITIO as SITE } from "@/lib/seo";

const AMENIDAD_LABEL: Record<string, string> = {
  piscina: "Piscina", gimnasio: "Gimnasio", vigilancia_24h: "Vigilancia 24h",
  planta_electrica: "Planta eléctrica", tanque_agua: "Tanque de agua",
  area_social: "Área social", pet_friendly: "Pet friendly", parrillera: "Parrillera",
  ascensor: "Ascensor", parque_infantil: "Parque infantil", cancha: "Cancha", lavanderia: "Lavandería",
};

/** §9: el CTA lleva el mensaje precargado y la URL del inmueble. */
function ctaWhatsapp(l: Listing) {
  const url = `${SITE}${rutaFicha(l)}`;
  if (l.whatsapp) {
    return {
      href: `https://wa.me/${l.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, me interesa este inmueble: ${url}`)}`,
      label: "Contactar por WhatsApp",
    };
  }
  // fallback documentado: si no hay número, se cae al perfil de origen
  return l.fuente.handle
    ? { href: `https://instagram.com/${l.fuente.handle}`, label: "Contactar por Instagram" }
    : null;
}

export default function Ficha({ l }: { l: Listing }) {
  const cta = ctaWhatsapp(l);
  const sim = similares(l);
  const tipoNombre = TIPO_LABEL[l.tipo].singular;

  const porM2 = precioM2(l);
  const medianaCiudad = medianaM2Ciudad(l.ciudad, l.operacion);
  const comparativa = porM2 !== null && medianaCiudad
    ? (() => {
        const dif = Math.round(((porM2 - medianaCiudad) / medianaCiudad) * 100);
        if (Math.abs(dif) < 5) return `En línea con la mediana de ${l.ciudadNombre}.`;
        return `${Math.abs(dif)}% ${dif > 0 ? "por encima" : "por debajo"} de la mediana de ${l.ciudadNombre} (US$ ${medianaCiudad.toLocaleString("es-VE")}/m²).`;
      })()
    : null;

  const anunciante = delMismoAnunciante(l);
  const opuesta = l.operacion === "venta" ? "alquiler" : "venta";
  const enlaces = [
    { href: rutaListado(l.operacion, l.tipo, [l.ciudad, l.estado]),
      label: `${TIPO_LABEL[l.tipo].plural} en ${l.ciudadNombre}`,
      count: cuantos({ ciudad: l.ciudad, tipo: l.tipo, operacion: l.operacion }) },
    ...(l.barrio ? [{ href: rutaListado(l.operacion, l.tipo, [l.ciudad, l.estado, l.barrio]),
      label: `${TIPO_LABEL[l.tipo].plural} en ${l.barrioNombre}`,
      count: cuantos({ ciudad: l.ciudad, barrio: l.barrio, tipo: l.tipo, operacion: l.operacion }) }] : []),
    { href: rutaListado(opuesta, l.tipo, [l.ciudad, l.estado]),
      label: `${TIPO_LABEL[l.tipo].plural} en ${opuesta} en ${l.ciudadNombre}`,
      count: cuantos({ ciudad: l.ciudad, tipo: l.tipo, operacion: opuesta }) },
    { href: rutaListado(l.operacion, l.tipo, [l.estado]),
      label: `${TIPO_LABEL[l.tipo].plural} en ${l.estadoNombre}`,
      count: cuantos({ estado: l.estado, tipo: l.tipo, operacion: l.operacion }) },
  ].filter((e) => e.count > 0);

  // solo los campos con valor: nunca un label vacío
  const caracteristicas = [
    ["Tipo", TIPO_LABEL[l.tipo].singular],
    ["Operación", OPERACION_LABEL[l.operacion]],
    ["Habitaciones", l.habitaciones],
    ["Baños", l.banos],
    ["Estacionamientos", l.estacionamientos],
    ["Área construida", l.m2 && `${l.m2} m²`],
    ["Área de terreno", l.areaTerreno && `${l.areaTerreno} m²`],
    ["Amoblado", l.amoblado === null ? null : l.amoblado ? "Sí" : "No"],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "") as [string, string | number][];

  const clave = [
    l.habitaciones && { Icono: IconBed, txt: `${l.habitaciones} ${l.habitaciones === 1 ? "habitación" : "habitaciones"}` },
    l.banos && { Icono: IconBath, txt: `${l.banos} ${l.banos === 1 ? "baño" : "baños"}` },
    l.m2 && { Icono: IconArea, txt: `${l.m2} m² construidos` },
    l.estacionamientos && { Icono: IconCar, txt: `${l.estacionamientos} ${l.estacionamientos === 1 ? "puesto" : "puestos"}` },
  ].filter(Boolean) as { Icono: (p: { size?: number }) => React.JSX.Element; txt: string }[];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {
          "@context": "https://schema.org", "@type": "Product",
          name: l.titulo,
          description: l.descripcion?.slice(0, 400) ?? l.titulo,
          ...(l.precio !== null && {
            offers: {
              "@type": "Offer", price: l.precio, priceCurrency: "USD",
              availability: "https://schema.org/InStock", url: `${SITE}${rutaFicha(l)}`,
            },
          }),
        },
        {
          "@context": "https://schema.org", "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: SITE },
            { "@type": "ListItem", position: 2, name: l.estadoNombre, item: `${SITE}${rutaListado(l.operacion, l.tipo, [l.estado])}` },
            { "@type": "ListItem", position: 3, name: l.ciudadNombre, item: `${SITE}${rutaListado(l.operacion, l.tipo, [l.ciudad, l.estado])}` },
            ...(l.barrio ? [{ "@type": "ListItem", position: 4, name: l.barrioNombre, item: `${SITE}${rutaListado(l.operacion, l.tipo, [l.ciudad, l.estado, l.barrio])}` }] : []),
          ],
        },
      ]) }} />

      <article className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <nav aria-label="Ruta" className="flex flex-wrap items-center gap-x-1.5 text-sm text-tinta-2">
          <Link href="/" className="hover:text-tinta hover:underline">Inicio</Link>
          {l.tipo && (
            <>
              <span className="text-tinta-3">›</span>
              <Link href={rutaListado(l.operacion, l.tipo, [l.estado])} className="hover:text-tinta hover:underline">{l.estadoNombre}</Link>
              <span className="text-tinta-3">›</span>
              <Link href={rutaListado(l.operacion, l.tipo, [l.ciudad, l.estado])} className="hover:text-tinta hover:underline">{l.ciudadNombre}</Link>
              {l.barrio && (
                <>
                  <span className="text-tinta-3">›</span>
                  <Link href={rutaListado(l.operacion, l.tipo, [l.ciudad, l.estado, l.barrio])} className="hover:text-tinta hover:underline">{l.barrioNombre}</Link>
                </>
              )}
            </>
          )}
        </nav>

        <h1 className="mt-4 max-w-3xl text-xl font-semibold tracking-tight sm:text-2xl">
          {tipoNombre} en {OPERACION_LABEL[l.operacion]} en {l.barrioNombre ? `${l.barrioNombre}, ` : ""}{l.ciudadNombre}
        </h1>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-tinta-2">
          <IconPin size={16} />
          {l.barrioNombre ? `${l.barrioNombre}, ` : ""}{l.ciudadNombre}, {l.estadoNombre}
        </p>

        {/* barra de datos clave: solo los presentes */}
        {clave.length > 0 && (
          <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-borde-suave py-4">
            {clave.map(({ Icono, txt }) => (
              <li key={txt} className="tabular flex items-center gap-2 text-sm text-tinta-2">
                <Icono size={20} />{txt}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <Seccion titulo="Galería">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Foto listing={l} priority ratio="aspect-[16/9]" sizes="(max-width:1024px) 100vw, 60vw" /></div>
              </div>
              {l.fotos.length === 0 && l.fotosCount > 0 && (
                <p className="mt-2 text-xs text-tinta-3">Este inmueble tiene {l.fotosCount} {l.fotosCount === 1 ? "foto publicada" : "fotos publicadas"} por el anunciante.</p>
              )}
            </Seccion>

            {l.descripcion && (
              <Seccion titulo="Descripción">
                <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-tinta-2">{l.descripcion}</p>
              </Seccion>
            )}

            {caracteristicas.length > 0 && (
              <Seccion titulo="Características">
                <dl className="max-w-xl divide-y divide-borde border-y border-borde">
                  {caracteristicas.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-sm text-tinta-2">{k}</dt>
                      <dd className="tabular text-sm font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Seccion>
            )}

            {l.amenidades.length > 0 && (
              <Seccion titulo="Amenidades">
                <ul className="flex flex-wrap gap-2">
                  {l.amenidades.map((a) => (
                    <li key={a} className="flex items-center gap-2 rounded-full border border-borde px-4 py-2 text-sm">
                      <IconCheck size={16} className="text-tinta" />
                      {AMENIDAD_LABEL[a] ?? a}
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            <Seccion titulo="Ubicación">
              <p className="text-base text-tinta-2">
                {l.barrioNombre ? `${l.barrioNombre}, ` : ""}{l.ciudadNombre}, {l.estadoNombre}.
              </p>
            </Seccion>
          </div>

          {/* contacto: sticky en escritorio, es el unico mecanismo de conversion */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-card border border-borde p-6 shadow-[var(--shadow-pill)]">
              <p className="tabular text-lg font-semibold">{formatPrecio(l.precio)}</p>
              <p className="mt-0.5 text-sm text-tinta-2">{tipoNombre} en {OPERACION_LABEL[l.operacion].toLowerCase()}</p>

              {/* situa el precio frente al mercado de su ciudad: el dato que de verdad
                  necesita quien compara, y que ningun competidor publica */}
              {porM2 !== null && (
                <div className="mt-4 rounded-xl bg-ambar-suave px-4 py-3">
                  <p className="tabular text-sm font-semibold text-ambar">
                    US$ {porM2.toLocaleString("es-VE")} <span className="font-normal">/m²</span>
                  </p>
                  {comparativa && (
                    <p className="mt-0.5 text-xs leading-snug text-tinta-2">{comparativa}</p>
                  )}
                </div>
              )}

              {cta ? (
                <a href={cta.href} target="_blank" rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-full bg-acento px-5 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  <IconWhatsapp size={18} />{cta.label}
                </a>
              ) : (
                <p className="mt-4 text-sm text-tinta-3">Sin datos de contacto disponibles.</p>
              )}

              {l.fuente.handle && (
                <p className="mt-4 text-xs leading-relaxed text-tinta-3">
                  Publicado en Instagram por{" "}
                  <a href={l.fuente.postUrl ?? `https://instagram.com/${l.fuente.handle}`}
                    target="_blank" rel="nofollow noopener noreferrer" className="underline hover:text-tinta">
                    @{l.fuente.handle}
                  </a>
                </p>
              )}

              <p className="mt-4 border-t border-borde-suave pt-3 text-xs leading-relaxed text-tinta-3">
                Verifica siempre el inmueble y la documentación en persona antes de entregar
                cualquier cantidad de dinero.
              </p>
            </div>

            {anunciante.muestra.length > 0 && (
              <div className="rounded-card border border-borde p-4">
                <p className="px-2 text-sm font-semibold">
                  Más de @{l.fuente.handle}
                  <span className="tabular ml-1 font-normal text-tinta-3">{anunciante.total}</span>
                </p>
                <div className="mt-2 space-y-1">
                  {anunciante.muestra.map((o) => <MiniFila key={o.publicId} listing={o} />)}
                </div>
              </div>
            )}

            <div className="rounded-card border border-borde p-4">
              <p className="px-2 text-sm font-semibold">Sigue explorando</p>
              <ul className="mt-2">
                {enlaces.map((e) => (
                  <li key={e.href}>
                    <Link href={e.href}
                      className="flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-humo">
                      <span className="min-w-0 truncate">{e.label}</span>
                      <span className="flex shrink-0 items-center gap-1 text-tinta-3">
                        <span className="tabular text-xs">{e.count}</span>
                        <IconChevron size={14} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {sim.length > 0 && (
          <Seccion titulo={`${TIPO_LABEL[l.tipo].plural} similares en ${l.ciudadNombre}`}>
            <Grid listings={sim} />
          </Seccion>
        )}
      </article>
    </>
  );
}
