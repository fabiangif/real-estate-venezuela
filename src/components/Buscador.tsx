"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { normalizarTexto } from "@/lib/search-core";
import { IconSearch } from "./icons";

const MAX_SUGERENCIAS = 7;

type Props = {
  sugerencias: string[];
  compacto?: boolean;
};

/** El Suspense conserva el HTML estático del layout mientras Next resuelve la URL. */
export function Buscador(props: Props) {
  return (
    <Suspense fallback={<CampoBusqueda {...props} valorInicial="" />}>
      <BusquedaConUrl {...props} />
    </Suspense>
  );
}

function BusquedaConUrl(props: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const valorInicial = pathname === "/buscar" ? searchParams.get("q")?.slice(0, 100) ?? "" : "";
  return <CampoBusqueda key={`${pathname}:${valorInicial}`} {...props} valorInicial={valorInicial} />;
}

/**
 * Búsqueda global con envío GET: funciona sin JavaScript y deja una URL compartible.
 * El autocompletado mejora la experiencia, pero nunca es requisito para buscar.
 */
function CampoBusqueda({
  sugerencias,
  compacto = false,
  valorInicial,
}: Props & { valorInicial: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState(valorInicial);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);

  useEffect(() => {
    const cerrarFuera = (evento: PointerEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, []);

  const opciones = useMemo(() => {
    const consulta = normalizarTexto(texto);
    if (!consulta) return sugerencias.slice(0, MAX_SUGERENCIAS);
    const terminos = consulta.split(" ").filter(Boolean);
    return sugerencias
      .filter((sugerencia) => {
        const normalizada = normalizarTexto(sugerencia);
        return terminos.every((termino) => normalizada.includes(termino));
      })
      .slice(0, MAX_SUGERENCIAS);
  }, [sugerencias, texto]);
  const listaVisible = abierto && opciones.length > 0;

  function seleccionar(valor: string) {
    setTexto(valor);
    setAbierto(false);
    setActivo(-1);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  function alTeclado(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      setAbierto(false);
      setActivo(-1);
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAbierto(true);
      setActivo((actual) => Math.min(actual + 1, opciones.length - 1));
      return;
    }
    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAbierto(true);
      setActivo((actual) => Math.max(actual - 1, 0));
      return;
    }
    if (evento.key === "Enter" && activo >= 0 && opciones[activo]) {
      evento.preventDefault();
      seleccionar(opciones[activo]);
    }
  }

  const alto = compacto ? "h-11" : "h-14";

  return (
    <div ref={contenedorRef} className="relative w-full">
      <form
        ref={formRef}
        action="/buscar"
        method="get"
        role="search"
        onSubmit={() => setAbierto(false)}
        className={`flex ${alto} w-full items-center rounded-full border border-borde bg-papel pl-5 shadow-[var(--shadow-pill)] transition-[height,box-shadow] duration-200 hover:shadow-[var(--shadow-pill-hover)] focus-within:border-tinta`}
      >
        <label htmlFor="busqueda-global" className="sr-only">Buscar inmuebles</label>
        <input
          id="busqueda-global"
          name="q"
          type="search"
          role="combobox"
          value={texto}
          minLength={2}
          maxLength={100}
          required
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Ciudad, zona, tipo o característica"
          aria-label="Busca por ciudad, zona, tipo o característica"
          aria-autocomplete="list"
          aria-controls={listaVisible ? "sugerencias-busqueda" : undefined}
          aria-expanded={listaVisible}
          aria-activedescendant={listaVisible && activo >= 0 ? `sugerencia-${activo}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base text-tinta outline-none placeholder:text-tinta-2"
          onChange={(evento) => {
            setTexto(evento.target.value);
            setAbierto(true);
            setActivo(-1);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclado}
        />
        <button
          type="submit"
          aria-label="Buscar inmuebles"
          className={`m-1 grid shrink-0 place-content-center rounded-full bg-acento text-white transition-[width,height,opacity] duration-200 hover:opacity-90 ${compacto ? "size-9" : "size-11"}`}
        >
          <IconSearch size={compacto ? 17 : 20} />
        </button>
      </form>

      {listaVisible && (
        <ul
          id="sugerencias-busqueda"
          role="listbox"
          aria-label="Sugerencias de búsqueda"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-card border border-borde bg-papel py-2 shadow-[var(--shadow-pill-hover)]"
        >
          {opciones.map((opcion, indice) => (
            <li
              id={`sugerencia-${indice}`}
              key={opcion}
              role="option"
              aria-selected={indice === activo}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${indice === activo ? "bg-humo" : "hover:bg-humo"}`}
              onMouseDown={(evento) => evento.preventDefault()}
              onMouseEnter={() => setActivo(indice)}
              onClick={() => seleccionar(opcion)}
            >
              <IconSearch size={16} className="shrink-0 text-tinta-3" />
              <span className="truncate">{opcion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
