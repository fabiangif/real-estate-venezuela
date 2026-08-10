import Link from "next/link";
import { TIPO_LABEL, FAMILIA, COLOR_FAMILIA, type Tipo } from "@/lib/types";
import { ICONO_TIPO } from "./icons";

/**
 * Tira de categorías bajo la navbar, como la de Airbnb: icono + etiqueta,
 * scroll horizontal, el activo en negro con subrayado. Además de navegación
 * es interlinking real hacia cada combinación tipo × ubicación.
 */
export function TipoStrip({
  items, activo,
}: { items: { tipo: Tipo; href: string; total?: number }[]; activo?: Tipo }) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Tipos de inmueble" className="border-b border-borde-suave">
      <ul className="sin-scrollbar mx-auto flex max-w-6xl gap-8 overflow-x-auto px-5">
        {items.map(({ tipo, href, total }) => {
          const Icono = ICONO_TIPO[tipo];
          const on = tipo === activo;
          return (
            <li key={tipo} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`group flex flex-col items-center gap-1.5 border-b-2 pb-3 pt-4 transition-colors ${
                  on ? "border-acento text-tinta" : "border-transparent text-tinta-2 hover:border-borde hover:text-tinta"
                }`}
              >
                <Icono size={24} className={on ? COLOR_FAMILIA[FAMILIA[tipo]] : `${COLOR_FAMILIA[FAMILIA[tipo]]} opacity-55 transition-opacity group-hover:opacity-100`} />
                <span className="text-xs font-medium whitespace-nowrap">
                  {TIPO_LABEL[tipo].plural}
                  {total !== undefined && <span className="tabular ml-1 text-tinta-3">{total}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
