import type { Metadata } from "next";
import Link from "next/link";
import { buscarTexto } from "@/lib/search";
import { LOCATIONS, rutaListado, tiposConEnlace } from "@/lib/data";
import { locationImageForListings } from "@/lib/location-images";
import { Grid, Chips } from "@/components/ui";
import { LocationHero } from "@/components/LocationHero";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const POR_PAGINA = 24;

const parametro = (valor: string | string[] | undefined) =>
  (Array.isArray(valor) ? valor[0] : valor)?.trim().slice(0, 100) ?? "";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parametro((await searchParams).q);
  return {
    title: q ? `Resultados para “${q.slice(0, 55)}”` : "Buscar inmuebles",
    description: q
      ? `Resultados de inmuebles para ${q}. Filtra por ubicación, tipo y características.`
      : "Busca inmuebles en Venezuela por ciudad, zona, tipo, operación y características.",
    alternates: { canonical: "/buscar" },
    robots: { index: false, follow: true },
  };
}

function Paginacion({ query, pagina, total }: { query: string; pagina: number; total: number }) {
  if (total <= 1) return null;
  const href = (numero: number) => {
    const params = new URLSearchParams({ q: query });
    if (numero > 1) params.set("pagina", String(numero));
    return `/buscar?${params.toString()}`;
  };

  return (
    <nav aria-label="Paginación de resultados" className="mt-10 flex items-center justify-center gap-3">
      {pagina > 1 && (
        <Link href={href(pagina - 1)} rel="prev" className="rounded-full border border-borde px-4 py-2 text-sm hover:bg-humo">
          Anterior
        </Link>
      )}
      <span className="tabular text-sm text-tinta-2">Página {pagina} de {total}</span>
      {pagina < total && (
        <Link href={href(pagina + 1)} rel="next" className="rounded-full border border-borde px-4 py-2 text-sm hover:bg-humo">
          Siguiente
        </Link>
      )}
    </nav>
  );
}

export default async function BuscarPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parametro(params.q);
  const paginaTexto = parametro(params.pagina);
  const paginaSolicitada = /^\d+$/.test(paginaTexto) ? Number(paginaTexto) : Number.NaN;
  const todos = query.length >= 2 ? buscarTexto(query) : [];
  const totalPaginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  const pagina = Number.isFinite(paginaSolicitada)
    ? Math.min(Math.max(paginaSolicitada, 1), totalPaginas)
    : 1;
  const resultados = todos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const heroImage = locationImageForListings(todos);

  const ciudades = LOCATIONS.flatMap((estado) => estado.ciudades)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((ciudad) => ({
      href: rutaListado("venta", "apartamento", [ciudad.slug, ciudad.estado]),
      label: `Apartamentos en ${ciudad.nombre}`,
      count: ciudad.total,
    }));
  const tipos = tiposConEnlace().slice(0, 6).map((tipo) => ({
    href: tipo.href,
    label: tipo.label,
    count: tipo.total,
  }));

  const title = query ? `Resultados para “${query}”` : "Busca inmuebles en Venezuela";

  return (
    <>
      {heroImage && (
        <LocationHero image={heroImage}>
          <nav aria-label="Ruta" className="text-sm text-white/75">
            <Link href="/" className="hover:text-white hover:underline">Inicio</Link>
            <span className="mx-1.5 text-white/45">›</span>
            <span className="text-white">Buscar</span>
          </nav>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Resultados relacionados con {heroImage.city}
          </p>
          <h1 className="mt-2 max-w-4xl text-2xl font-semibold tracking-[-0.025em] text-white sm:text-3xl">
            {title}
          </h1>
          <p className="tabular mt-3 text-sm text-white/80 sm:text-base">
            {todos.length.toLocaleString("es-VE")} {todos.length === 1 ? "inmueble encontrado" : "inmuebles encontrados"}
          </p>
        </LocationHero>
      )}

      <div className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        {!heroImage && (
          <>
            <nav aria-label="Ruta" className="text-sm text-tinta-2">
              <Link href="/" className="hover:text-tinta hover:underline">Inicio</Link>
              <span className="mx-1.5 text-tinta-3">›</span>
              <span className="text-tinta">Buscar</span>
            </nav>

            <h1 className="mt-4 max-w-4xl text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
              {title}
            </h1>
          </>
        )}

        {!query ? (
          <>
            <p className="mt-3 max-w-2xl leading-relaxed text-tinta-2">
              Usa la barra superior para combinar una ubicación, un tipo y las características
              que necesitas. Por ejemplo: “apartamento en Caracas de 3 habitaciones con piscina”.
            </p>
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Búsquedas populares por ciudad</h2>
              <div className="mt-4"><Chips items={ciudades} /></div>
            </section>
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Explora por tipo de inmueble</h2>
              <div className="mt-4"><Chips items={tipos} /></div>
            </section>
          </>
        ) : query.length < 2 ? (
          <p className="mt-4 rounded-card border border-borde px-5 py-10 text-center text-tinta-2">
            Escribe al menos dos caracteres para buscar.
          </p>
        ) : todos.length > 0 ? (
          <section className={heroImage ? "mt-2" : "mt-8"} aria-labelledby="total-resultados">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
              <h2 id="total-resultados" className="text-lg font-semibold">
                {heroImage ? "Inmuebles que coinciden con tu búsqueda" : (
                  <>{todos.length.toLocaleString("es-VE")} {todos.length === 1 ? "inmueble encontrado" : "inmuebles encontrados"}</>
                )}
              </h2>
              {totalPaginas > 1 && (
                <p className="tabular text-sm text-tinta-2">
                  Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, todos.length)}
                </p>
              )}
            </div>
            <Grid listings={resultados} />
            <Paginacion query={query} pagina={pagina} total={totalPaginas} />
          </section>
        ) : (
          <section className="mt-8 rounded-card border border-borde px-5 py-10 text-center">
            <h2 className="font-semibold">No encontramos una coincidencia exacta</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-tinta-2">
              Prueba con menos características o revisa la escritura. También puedes explorar
              una ciudad o un tipo de inmueble desde los enlaces de la portada.
            </p>
            <Link href="/" className="mt-5 inline-flex rounded-full bg-tinta px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              Volver al inicio
            </Link>
          </section>
        )}
      </div>
    </>
  );
}
