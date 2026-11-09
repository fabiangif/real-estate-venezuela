import Link from "next/link";
import { LOCATIONS, rutaListado, tiposConEnlace } from "@/lib/data";
import { Chips } from "@/components/ui";
import { IconPin } from "@/components/icons";

export const metadata = { title: "Página no encontrada", robots: { index: false, follow: true } };

/**
 * 404 propia. La de Next sale en ingles y con fondo oscuro: rompe la identidad y,
 * peor, deja al usuario sin salida. Esta ofrece rutas reales hacia el inventario.
 */
export default function NoEncontrada() {
  const ciudades = LOCATIONS.flatMap((e) => e.ciudades).sort((a, b) => b.total - a.total);
  const tipos = tiposConEnlace().slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 text-center">
      <p className="tabular text-sm font-semibold text-acento">Error 404</p>
      <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.03em]">Esta página no existe</h1>
      <p className="mt-3 leading-relaxed text-tinta-2">
        Puede que el inmueble ya no esté publicado o que la dirección tenga una errata.
        Sigue desde aquí:
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
        {ciudades.map((c) => (
          <Link key={c.slug} href={rutaListado("venta", "apartamento", [c.slug, c.estado])}
            className="rounded-card border border-borde px-4 py-3 transition-colors hover:border-tinta hover:bg-humo">
            <span className="flex items-center gap-1.5 font-medium">
              <IconPin size={15} className="text-acento" />{c.nombre}
            </span>
            <span className="tabular mt-0.5 block text-sm text-tinta-2">{c.total} inmuebles</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
<Chips items={tipos.map((t) => ({ href: t.href, label: t.label, count: t.total }))} />
      </div>

      <Link href="/" className="mt-10 inline-block rounded-full bg-acento px-6 py-3.5 text-base font-bold text-white hover:opacity-90">
        Volver al inicio
      </Link>
    </div>
  );
}
