import Link from "next/link";
import Image from "next/image";
import { formatPrecio, TIPO_LABEL, FAMILIA, COLOR_FAMILIA, type Listing, type Operacion } from "@/lib/types";
import { rutaFicha } from "@/lib/data";
import { ICONO_TIPO, IconBed, IconBath, IconArea } from "./icons";

/**
 * Foto del inmueble. Ratio 4:3 fijo en todo el grid: la consistencia del ratio es
 * lo que hace que un grid se vea profesional, y evita layout shift.
 * Sin imágenes reales muestra un marcador deliberado con el icono del tipo — nunca un roto.
 */
export function Foto({
  listing, priority = false, sizes = "(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw", ratio = "aspect-[4/3]",
}: { listing: Listing; priority?: boolean; sizes?: string; ratio?: string }) {
  const src = listing.fotos[0];
  const Icono = ICONO_TIPO[listing.tipo];
  return (
    <div className={`relative ${ratio} overflow-hidden rounded-card bg-humo`}>
      {src ? (
        <Image src={src} alt={listing.titulo} fill sizes={sizes} priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-tinta-3">
          <Icono size={30} className={`${COLOR_FAMILIA[FAMILIA[listing.tipo]]} opacity-45`} />
          <span className="text-xs">
            {listing.fotosCount > 0
              ? `${listing.fotosCount} ${listing.fotosCount === 1 ? "foto" : "fotos"}`
              : TIPO_LABEL[listing.tipo].singular}
          </span>
        </div>
      )}
    </div>
  );
}

/** El color aquí CLASIFICA: de un vistazo se distingue comprar de alquilar. */
export function BadgeOperacion({ operacion }: { operacion: Operacion }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
      operacion === "venta" ? "bg-acento-suave text-acento" : "bg-mar-suave text-mar"
    }`}>
      {operacion === "venta" ? "En venta" : "En alquiler"}
    </span>
  );
}

/**
 * Tres lineas, en el orden en que se compara: precio grande · datos con icono ·
 * que es y donde. Sin badges sobre la foto: la operacion va en la linea de texto
 * y el "/mes" ya distingue un alquiler.
 */
export function ListingCard({ listing, priority }: { listing: Listing; priority?: boolean }) {
  // un terreno no tiene area construida: su dato esencial es la del terreno
  const area = listing.m2 ?? listing.areaTerreno;
  // el nombre solo lo lee el lector de pantalla: a la vista basta el icono
  const datos = [
    listing.habitaciones && { Icono: IconBed, v: listing.habitaciones, nombre: listing.habitaciones === 1 ? "habitación" : "habitaciones" },
    listing.banos && { Icono: IconBath, v: listing.banos.toLocaleString("es-VE"), nombre: listing.banos === 1 ? "baño" : "baños" },
    area && { Icono: IconArea, v: `${area} m²`, nombre: listing.m2 ? "construidos" : "de terreno" },
  ].filter(Boolean) as { Icono: typeof IconBed; v: string | number; nombre: string }[];

  const donde = [listing.barrioNombre, listing.ciudadNombre].filter(Boolean).join(", ");

  return (
    <Link href={rutaFicha(listing)} className="group block">
      <Foto listing={listing} priority={priority} />
      <div className="mt-3">
        <p className="tabular truncate text-xl font-bold tracking-[-0.01em]">
          {listing.precio === null ? (
            <span className="text-lg font-semibold text-tinta-2">Precio a consultar</span>
          ) : (
            <>
              {formatPrecio(listing.precio)}
              {listing.operacion === "alquiler" && <span className="text-sm font-normal text-tinta-2"> /mes</span>}
            </>
          )}
        </p>
        {datos.length > 0 && (
          <ul className="tabular mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {datos.map(({ Icono, v, nombre }) => (
              <li key={nombre} className="flex items-center gap-1.5">
                <Icono size={17} className="text-tinta-2" />{v}
                <span className="sr-only">{nombre}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 truncate text-sm text-tinta-2">
          {TIPO_LABEL[listing.tipo].singular} en {listing.operacion} · {donde}
        </p>
      </div>
    </Link>
  );
}

export function Grid({ listings }: { listings: Listing[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((l, i) => (
        <ListingCard key={l.publicId} listing={l} priority={i < 4} />
      ))}
    </div>
  );
}

/** Interlinking. Pills con borde, como los filtros de Airbnb. */
export function Chips({ items }: { items: { href: string; label: string; count?: number }[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-borde px-4 py-2 text-sm transition-colors hover:border-tinta hover:bg-humo">
            {i.label}
            {i.count !== undefined && <span className="tabular text-xs text-tinta-3">{i.count}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-[-0.01em]">{titulo}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Banda a sangre completa con fondo tintado. Separa secciones por color de fondo
 * en vez de dibujar más cajas: es lo que rompe la monotonía del blanco sin ruido.
 */
export function Banda({ tono, children }: { tono: "crema" | "menta"; children: React.ReactNode }) {
  return (
    <section className={`mt-14 ${tono === "crema" ? "bg-crema" : "bg-menta"}`}>
      <div className="mx-auto max-w-7xl px-5 py-12">{children}</div>
    </section>
  );
}

/** Fila compacta para listas laterales: no compite con las tarjetas del grid. */
export function MiniFila({ listing }: { listing: Listing }) {
  const Icono = ICONO_TIPO[listing.tipo];
  return (
    <Link href={rutaFicha(listing)} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-humo">
      <span className="grid size-12 shrink-0 place-content-center rounded-lg bg-humo">
        <Icono size={20} className={`${COLOR_FAMILIA[FAMILIA[listing.tipo]]} opacity-60`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {listing.barrioNombre ?? TIPO_LABEL[listing.tipo].singular}
        </span>
        <span className="tabular block truncate text-sm text-tinta-2">
          {formatPrecio(listing.precio)}
          {/* sin esto un alquiler de US$ 2.200 se lee como una venta absurda */}
          {listing.operacion === "alquiler" && listing.precio !== null && " /mes"}
        </span>
        <span className={`block truncate text-xs ${listing.operacion === "venta" ? "text-acento" : "text-mar"}`}>
          {TIPO_LABEL[listing.tipo].singular} · {listing.operacion === "venta" ? "Venta" : "Alquiler"}
        </span>
      </span>
    </Link>
  );
}
