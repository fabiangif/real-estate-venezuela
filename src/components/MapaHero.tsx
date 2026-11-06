"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { Punto } from "./Mapa";

/**
 * Alto del mapa, compartido por el marcador de carga y el mapa real para que no haya salto.
 * En sm+ no llena la pantalla: deja asomar la seccion siguiente para que se note que hay mas.
 */
const ALTO = "h-[52dvh] min-h-[20rem] sm:h-[calc(100dvh-13rem)] sm:max-h-[44rem] sm:min-h-[26rem]";

/**
 * Mapa del hero. MapLibre (~250 KB) y los puntos se cargan despues de la hidratacion.
 *
 * El panel (H1 + texto) se pinta SIEMPRE, tambien en el marcador de carga: asi esta en
 * el HTML estatico desde el primer byte y ni el LCP ni Google dependen del mapa.
 */
export function MapaHero({ children }: { children?: React.ReactNode }) {
  const [Mapa, setMapa] = useState<ComponentType<{ puntos: Punto[]; alto: string; children?: React.ReactNode }> | null>(null);
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

  // movil: bloque normal encima del mapa · sm+: flota abajo a la izquierda, sobre el mapa
  const panel = children && (
    <div className="sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:pb-6 sm:pt-0">
        <div className="sm:pointer-events-auto sm:max-w-lg">{children}</div>
      </div>
    </div>
  );

  if (Mapa && puntos) return <Mapa puntos={puntos} alto={ALTO}>{panel}</Mapa>;

  return (
    // mismo marco que pinta Mapa: si cambia alli, cambia aqui
    <div className="relative flex flex-col-reverse sm:block">
      <div className={`grid w-full place-content-center bg-humo text-sm text-tinta-2 ${ALTO}`}>
        {error ? "No se pudo cargar el mapa." : "Cargando mapa…"}
      </div>
      {panel}
    </div>
  );
}
