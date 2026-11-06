import { MARCA } from "@/lib/seo";

/**
 * Logo "Techo": la u lleva un techo encima, y la letra con su techo queda como una casa.
 *
 * Es texto real (Figtree 800) con el techo en SVG sobre la u: escala con font-size y
 * hereda el color del texto; solo el techo lleva el acento. El nombre accesible va en
 * aria-label para que el lector de pantalla no deletree las letras sueltas.
 *
 * Si cambia el nombre: las letras de aqui y MARCA en src/lib/seo.ts.
 * El icono suelto (favicon, tarjeta OG) no puede depender de la fuente: vive dibujado
 * a mano en src/app/icon.svg.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label={MARCA}
      className={`inline-flex font-extrabold leading-none tracking-[-0.035em] ${className}`}>
      m
      <span className="relative inline-block">
        u
        <svg viewBox="0 0 28 12" aria-hidden="true" focusable="false"
          className="absolute left-1/2 top-0 h-[0.257em] w-[0.6em] -translate-x-1/2 overflow-visible text-acento">
          <path d="M3 10 14 3l11 7" fill="none" stroke="currentColor" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      dave
    </span>
  );
}
