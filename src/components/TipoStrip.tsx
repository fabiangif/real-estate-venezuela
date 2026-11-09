import Link from "next/link";
import { TIPO_LABEL, FAMILIA, COLOR_FAMILIA, type Tipo } from "@/lib/types";
import { ICONO_TIPO } from "./icons";

/**
 * Tira de categorías bajo la navbar: una pastilla por tipo, con icono y conteo, en
 * scroll horizontal. La activa va en negro, igual que los demás filtros del sitio.
 * Además de navegación es interlinking real hacia cada combinación tipo × ubicación.
 */
export function TipoStrip({
  items, activo,
}: { items: { tipo: Tipo; href: string; total?: number }[]; activo?: Tipo }) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Tipos de inmueble" className="border-b border-borde-suave">
      <ul className="sin-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3">
        {items.map(({ tipo, href, total }) => {
          const Icono = ICONO_TIPO[tipo];
          const on = tipo === activo;
          return (
            <li key={tipo} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  on ? "bg-tinta text-white" : "bg-humo text-tinta hover:bg-borde-suave"
                }`}
              >
                <Icono size={20} className={on ? "text-white" : COLOR_FAMILIA[FAMILIA[tipo]]} />
                {TIPO_LABEL[tipo].plural}
                {total !== undefined && (
                  <span className={`tabular text-xs ${on ? "text-white/70" : "text-tinta-3"}`}>{total}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
