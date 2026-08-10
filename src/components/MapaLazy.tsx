"use client";

import { useState, type ComponentType } from "react";
import { IconMap, IconPencil } from "./icons";
import type { Punto } from "./Mapa";

/**
 * El mapa pesa (~250 KB de MapLibre + tiles). El Home es la página más importante
 * para SEO, así que no se carga nada hasta que el usuario lo pide: hasta entonces
 * esto es HTML estático y el LCP no se entera.
 */
export function MapaLazy({ total }: { total: number }) {
  const [Mapa, setMapa] = useState<ComponentType<{ puntos: Punto[] }> | null>(null);
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  async function abrir() {
    setCargando(true);
    setError(false);
    try {
      const [mod, res] = await Promise.all([import("./Mapa"), fetch("/mapa.json")]);
      if (!res.ok) throw new Error(String(res.status));
      setPuntos(await res.json());
      setMapa(() => mod.default);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  if (Mapa && puntos) return <Mapa puntos={puntos} />;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-borde px-6 py-16 text-center">
      <IconMap size={34} className="text-tinta-3" />
      <div>
        <p className="font-semibold">Explora los {total.toLocaleString("es-VE")} inmuebles en el mapa</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-tinta-2">
          <IconPencil size={15} /> Dibuja a mano la zona que te interesa y filtra solo esos inmuebles
        </p>
      </div>
      <button onClick={abrir} disabled={cargando}
        className="rounded-full bg-acento px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
        {cargando ? "Cargando mapa…" : "Abrir el mapa"}
      </button>
      {error && (
        <p className="text-sm text-tinta-2">No se pudo cargar el mapa. Revisa tu conexión e inténtalo de nuevo.</p>
      )}
    </div>
  );
}
