"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TIPO_LABEL, type Operacion, type Tipo } from "@/lib/types";
import { IconSearch } from "./icons";

export type OpcionCiudad = { slug: string; nombre: string; estado: string };

/**
 * Pill de búsqueda de la navbar. Navega de verdad: compone la ruta pSEO y empuja.
 * Selects nativos a propósito — accesibles, con teclado, y cero JS de librería.
 */
export function Buscador({
  ciudades, tipos, compacto = false,
}: { ciudades: OpcionCiudad[]; tipos: Tipo[]; compacto?: boolean }) {
  const router = useRouter();
  const [operacion, setOperacion] = useState<Operacion>("venta");
  const [tipo, setTipo] = useState<Tipo>(tipos.includes("apartamento") ? "apartamento" : tipos[0]);
  const [ciudad, setCiudad] = useState(ciudades[0]?.slug ?? "");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const c = ciudades.find((x) => x.slug === ciudad);
    if (!c) return;
    router.push(`/${operacion}/${TIPO_LABEL[tipo].slug}/${c.slug}/${c.estado}`);
  }

  // al compactar desaparecen las etiquetas y queda solo el valor: misma funcion, menos altura
  const segmento = `flex min-w-0 flex-1 flex-col justify-center text-left transition-[padding] duration-200 ${
    compacto ? "px-4 py-1.5" : "px-5 py-2"
  }`;
  const etiqueta = `overflow-hidden text-[11px] font-semibold leading-tight text-tinta transition-all duration-200 ${
    compacto ? "h-0 opacity-0" : "h-4 opacity-100"
  }`;
  const campo =
    "-ml-1 w-full cursor-pointer appearance-none truncate bg-transparent text-sm leading-tight text-tinta-2 outline-none";

  return (
    <form
      onSubmit={buscar}
      className="flex w-full items-center rounded-full border border-borde bg-papel shadow-[var(--shadow-pill)] transition-shadow hover:shadow-[var(--shadow-pill-hover)]"
    >
      <div className={segmento}>
        <label htmlFor="b-op" className={etiqueta}>Operación</label>
        <select id="b-op" className={campo} value={operacion} onChange={(e) => setOperacion(e.target.value as Operacion)}>
          <option value="venta">En venta</option>
          <option value="alquiler">En alquiler</option>
        </select>
      </div>

      <span className={`w-px shrink-0 bg-borde transition-[height] duration-200 ${compacto ? "h-5" : "h-8"}`} />

      <div className={segmento}>
        <label htmlFor="b-tipo" className={etiqueta}>Tipo</label>
        <select id="b-tipo" className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          {tipos.map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t].plural}</option>
          ))}
        </select>
      </div>

      <span className={`hidden w-px shrink-0 bg-borde transition-[height] duration-200 sm:block ${compacto ? "h-5" : "h-8"}`} />

      <div className={`${segmento} hidden sm:flex`}>
        <label htmlFor="b-ciudad" className={etiqueta}>Dónde</label>
        <select id="b-ciudad" className={campo} value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
          {ciudades.map((c) => (
            <option key={c.slug} value={c.slug}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        aria-label="Buscar inmuebles"
        className={`m-1.5 grid shrink-0 place-content-center rounded-full bg-acento text-white transition-[width,height,opacity] duration-200 hover:opacity-90 ${compacto ? "size-8" : "size-10"}`}
      >
        <IconSearch size={compacto ? 16 : 18} />
      </button>
    </form>
  );
}
