"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { Punto } from "./Mapa";

/**
 * Mapa del hero. Se monta despues de la hidratacion, no en el render inicial:
 * asi el H1 y el texto del hero (que son HTML estatico) pintan de inmediato y
 * el LCP no depende de los ~250 KB de MapLibre ni de los tiles.
 */
export function MapaHero({ children }: { children?: React.ReactNode }) {
  const [Mapa, setMapa] = useState<ComponentType<{ puntos: Punto[]; hero?: boolean; children?: React.ReactNode }> | null>(null);
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [mod, res] = await Promise.all([import("./Mapa"), fetch("/mapa.json")]);
        if (!res.ok) throw new Error(String(res.status));
        const datos = await res.json();
        if (!vivo) return;
        setPuntos(datos);
        setMapa(() => mod.default);
      } catch {
        if (vivo) setError(true);
      }
    })();
    return () => { vivo = false; };
  }, []);

  if (Mapa && puntos) return <Mapa puntos={puntos} hero>{children}</Mapa>;

  return (
    <div className="grid h-[calc(100dvh-4.75rem)] max-h-[48rem] min-h-[28rem] w-full place-content-center bg-humo text-sm text-tinta-2">
      {error ? "No se pudo cargar el mapa." : "Cargando mapa…"}
    </div>
  );
}
