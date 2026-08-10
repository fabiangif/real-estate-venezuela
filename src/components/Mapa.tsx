"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// maplibre-gl 6 no expone export default: solo nombrados
import { Map as MapLibre, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { formatPrecio, TIPO_LABEL, type Tipo, type Operacion } from "@/lib/types";
import { IconPencil, IconTrash, IconClose, IconBed, IconBath, IconArea, IconChevron } from "./icons";
import { ICONO_TIPO } from "./icons";
import { dentro } from "@/lib/geo";

export type Punto = {
  id: string; lat: number; lng: number;
  precio: number | null; tipo: Tipo; op: Operacion;
  barrio: string | null; ciudad: string;
  hab: number | null; m2: number | null; url: string;
};

/**
 * Positron de CARTO en RASTER, con un estilo minimo escrito aqui mismo.
 * El estilo vectorial de CARTO encadena TileJSON + sprite + glyphs + 93 capas y
 * nunca completaba (isStyleLoaded() se quedaba en false, el mapa en blanco).
 * Raster son imagenes: una peticion por tile y nada mas que resolver.
 * Los glyphs se declaran aparte porque si los necesitan las etiquetas de precio.
 */
const ESTILO = {
  version: 8 as const,
  glyphs: "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf",
  sources: {
    base: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution:
        '© <a href="https://carto.com/attributions">CARTO</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: "base", type: "raster" as const, source: "base" }],
};
/** Venezuela continental. */
const VENEZUELA: [[number, number], [number, number]] = [[-73.4, 0.6], [-59.8, 12.3]];
const ACENTO = "#d9480f";

/**
 * MapLibre 6 arranca su worker importando una URL resuelta contra import.meta.url,
 * que dentro del bundle de Turbopack no existe: el worker muere en silencio y ninguna
 * fuente GeoJSON llega a teselarse. Se sirve desde public/ (ver scripts/copy-map-worker.mjs).
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const etiqueta = (p: Punto) =>
  p.precio === null ? "Consultar" : p.precio >= 1000 ? `$${Math.round(p.precio / 1000)}k` : `$${p.precio}`;

const aFeature = (p: Punto) => ({
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
  properties: { id: p.id, label: etiqueta(p) },
});

export default function Mapa({
  puntos, hero = false, children,
}: { puntos: Punto[]; hero?: boolean; children?: React.ReactNode }) {
  const cont = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [dibujando, setDibujando] = useState(false);
  const [trazo, setTrazo] = useState<[number, number][] | null>(null); // px en pantalla
  const [poligono, setPoligono] = useState<[number, number][] | null>(null);
  const [filtroOp, setFiltroOp] = useState<"todo" | Operacion>("todo");
  const [sel, setSel] = useState<Punto | null>(null);

  // la zona dibujada y el filtro de operacion se COMBINAN; derivar en vez de
  // guardar la lista evita que uno pise al otro
  const visibles = useMemo(
    () => puntos.filter((p) =>
      (filtroOp === "todo" || p.op === filtroOp) &&
      (!poligono || dentro(p.lng, p.lat, poligono))),
    [puntos, filtroOp, poligono]
  );
  const zonaActiva = poligono !== null;

  const porId = useRef(new Map(puntos.map((p) => [p.id, p])));

  // --- inicializacion del mapa ---
  useEffect(() => {
    if (!cont.current || map.current) return;
    const m = new MapLibre({
      container: cont.current,
      style: ESTILO,
      bounds: VENEZUELA,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    });
    map.current = m;

    m.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // Las capas se montan en cuanto el estilo esta listo, no en "load": ese evento
    // espera al primer render completo y puede tardar (o no llegar) en conexiones
    // lentas, dejando el mapa sin un solo inmueble encima.
    let montadas = false;
    const montarCapas = () => {
      if (montadas || !m.isStyleLoaded()) return;
      montadas = true;
      setListo(true);
      try {
      m.addSource("inmuebles", {
        type: "geojson",
        data: { type: "FeatureCollection", features: puntos.map(aFeature) },
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 13,
      });

      m.addLayer({
        id: "clusters", type: "circle", source: "inmuebles", filter: ["has", "point_count"],
        paint: {
          "circle-color": ACENTO,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 21, 50, 27, 200, 34],
          "circle-stroke-width": 2.5, "circle-stroke-color": "#fff",
        },
      });
      m.addLayer({
        id: "clusters-n", type: "symbol", source: "inmuebles", filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Open Sans Bold"], "text-size": 12 },
        paint: { "text-color": "#fff" },
      });
      m.addLayer({
        id: "punto", type: "circle", source: "inmuebles", filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": "#fff", "circle-radius": 5, "circle-stroke-width": 2.5, "circle-stroke-color": ACENTO },
      });
      m.addLayer({
        id: "precio", type: "symbol", source: "inmuebles", filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "label"], "text-font": ["Open Sans Bold"], "text-size": 12,
          "text-offset": [0, -1.4], "text-allow-overlap": false,
        },
        paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 2 },
      });

      m.on("click", "clusters", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        (m.getSource("inmuebles") as GeoJSONSource)
          .getClusterExpansionZoom(f.properties.cluster_id as number)
          .then((z) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z }));
      });
      m.on("click", "punto", (e) => {
        const id = e.features?.[0]?.properties?.id as string;
        setSel(porId.current.get(id) ?? null);
      });

      for (const capa of ["clusters", "punto"]) {
        m.on("mouseenter", capa, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", capa, () => (m.getCanvas().style.cursor = ""));
      }
      } catch (err) {
        // sin esto un fallo aqui deja el mapa base pintado y ni un inmueble encima,
        // sin una sola pista de por que
        montadas = false;
        setFallo(err instanceof Error ? err.message : String(err));
        console.error("mapa: no se pudieron montar las capas", err);
      }
    };
    // se intenta en cada evento que pueda dejar el estilo listo; la guarda de arriba
    // hace que solo el primero que llegue haga el trabajo
    for (const ev of ["styledata", "sourcedata", "load", "idle"] as const) m.on(ev, montarCapas);
    montarCapas();

    m.on("error", (e) => {
      const msg = e.error?.message ?? "error desconocido";
      console.error("mapa:", msg);
      setFallo(msg);
    });

    // "load" espera al primer render completo; si tarda, el velo deja de tapar
    // igualmente: mas vale un mapa a medio pintar que un recuadro en blanco.
    const destape = setTimeout(() => setListo(true), 3000);

    // el canvas se mide al montar: sin esto queda descuadrado si el layout cambia despues
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(cont.current);

    return () => { clearTimeout(destape); ro.disconnect(); m.remove(); map.current = null; };
  }, [puntos]);

  // --- el mapa refleja lo derivado, nunca al reves ---
  useEffect(() => {
    (map.current?.getSource("inmuebles") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection", features: visibles.map(aFeature),
    });
  }, [visibles, listo]);

  const limpiar = useCallback(() => {
    setTrazo(null); setPoligono(null); setSel(null);
    map.current?.fitBounds(VENEZUELA, { padding: 40 });
  }, []);

  // --- dibujo a mano alzada sobre el lienzo ---
  useEffect(() => {
    const m = map.current;
    const el = cont.current;
    if (!m || !el || !dibujando) return;

    // mientras se dibuja, el mapa no debe arrastrarse ni hacer zoom
    m.dragPan.disable(); m.scrollZoom.disable(); m.doubleClickZoom.disable();
    m.getCanvas().style.cursor = "crosshair";

    let pts: [number, number][] = [];
    let activo = false;

    const punto = (e: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e: PointerEvent) => {
      activo = true; pts = [punto(e)]; setTrazo(pts);
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!activo) return;
      const p = punto(e);
      const u = pts[pts.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 4) return; // no guardar micro-movimientos
      pts = [...pts, p];
      setTrazo(pts);
    };
    const up = () => {
      if (!activo) return;
      activo = false;
      if (pts.length < 3) { setTrazo(null); return; }
      const poly = pts.map((p) => {
        const ll = m.unproject(p as [number, number]);
        return [ll.lng, ll.lat] as [number, number];
      });
      setPoligono(poly);
      setDibujando(false);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      m.dragPan.enable(); m.scrollZoom.enable(); m.doubleClickZoom.enable();
      m.getCanvas().style.cursor = "";
    };
  }, [dibujando]);

  const d = trazo?.length ? `M${trazo.map((p) => p.join(",")).join("L")}Z` : "";

  return (
    <div>
      <div className={`relative overflow-hidden ${hero ? "" : "rounded-card border border-borde"}`}>
        <div ref={cont} className={`w-full touch-none ${hero ? "h-[calc(100dvh-4.75rem)] max-h-[48rem] min-h-[28rem]" : "h-[30rem] sm:h-[34rem]"}`} />

        {/* trazo en vivo, por encima del lienzo */}
        <svg ref={svg} className="pointer-events-none absolute inset-0 h-full w-full">
          {d && <path d={d} fill={`${ACENTO}1a`} stroke={ACENTO} strokeWidth={2.5} strokeLinejoin="round" />}
        </svg>

        {/* controles flotantes */}
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <button
            onClick={() => { setDibujando((v) => !v); setTrazo(null); }}
            aria-pressed={dibujando}
            className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-pill)] transition-colors ${
              dibujando ? "border-acento bg-acento text-white" : "border-borde bg-papel hover:bg-humo"
            }`}
          >
            <IconPencil size={16} />
            {dibujando ? "Dibuja la zona…" : "Dibujar zona"}
          </button>

          <div className="flex gap-1 rounded-full border border-borde bg-papel p-1 shadow-[var(--shadow-pill)]">
            {([["todo", "Todo"], ["venta", "Venta"], ["alquiler", "Alquiler"]] as const).map(([v, t]) => (
              <button key={v} onClick={() => { setFiltroOp(v); setSel(null); }}
                aria-pressed={filtroOp === v}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  filtroOp === v
                    ? v === "alquiler" ? "bg-mar text-white" : v === "venta" ? "bg-acento text-white" : "bg-tinta text-white"
                    : "text-tinta-2 hover:bg-humo"
                }`}>
                {t}
              </button>
            ))}
          </div>

          {zonaActiva && (
            <button onClick={limpiar}
              className="flex items-center gap-2 rounded-full border border-borde bg-papel px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-pill)] transition-colors hover:bg-humo">
              <IconTrash size={16} />Quitar zona
            </button>
          )}
        </div>

        {hero && !zonaActiva && (
          <p className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-borde bg-papel px-4 py-2 text-sm font-medium shadow-[var(--shadow-pill)]">
            <span className="tabular">{visibles.length}</span>{" "}
            {filtroOp === "venta" ? "en venta" : filtroOp === "alquiler" ? "en alquiler" : "inmuebles"} en el mapa
          </p>
        )}

        {dibujando && (
          <p className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-tinta/90 px-4 py-2 text-xs text-white">
            Mantén pulsado y dibuja alrededor de la zona que te interesa
          </p>
        )}

        {!listo && (
          <div className="absolute inset-0 grid place-content-center bg-humo text-sm text-tinta-2">Cargando mapa…</div>
        )}

        {fallo && (
          <p className="absolute inset-x-3 top-3 mx-auto w-fit max-w-full rounded-full bg-papel px-4 py-2 text-xs text-acento shadow-[var(--shadow-pill)]">
            El mapa no cargó del todo: {fallo}
          </p>
        )}

        {/* el panel del hero se aparta en cuanto hay algo que mirar: sin esto se
            solapaba con la tarjeta del inmueble */}
        {children && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
            sel || dibujando ? "pointer-events-none opacity-0" : "opacity-100"
          }`}>
            <div className="mx-auto max-w-7xl px-5 pb-5">
              <div className="pointer-events-auto max-w-lg">{children}</div>
            </div>
          </div>
        )}

        {/* tarjeta del punto seleccionado */}
        {sel && (() => {
          const Icono = ICONO_TIPO[sel.tipo];
          const datos = [
            sel.hab && { I: IconBed, t: `${sel.hab} hab` },
            sel.m2 && { I: IconArea, t: `${sel.m2} m²` },
          ].filter(Boolean) as { I: (p: { size?: number }) => React.JSX.Element; t: string }[];

          return (
            <article className="absolute inset-x-3 bottom-3 overflow-hidden rounded-card border border-borde bg-papel shadow-[var(--shadow-pill-hover)] sm:inset-x-auto sm:right-4 sm:w-[21rem]">
              <button onClick={() => setSel(null)} aria-label="Cerrar"
                className="absolute right-3 top-3 z-10 grid size-8 place-content-center rounded-full bg-papel/90 text-tinta shadow-sm backdrop-blur transition-colors hover:bg-humo">
                <IconClose size={16} />
              </button>

              <div className="relative flex aspect-[16/9] items-center justify-center bg-humo">
                <Icono size={38} className="text-acento opacity-40" />
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  sel.op === "venta" ? "bg-papel text-acento" : "bg-papel text-mar"
                }`}>
                  {sel.op === "venta" ? "Venta" : "Alquiler"}
                </span>
              </div>

              <div className="p-4">
                <p className="truncate font-semibold">{sel.barrio ?? TIPO_LABEL[sel.tipo].singular}</p>
                <p className="truncate text-sm text-tinta-2">{TIPO_LABEL[sel.tipo].singular} · {sel.ciudad}</p>

                {datos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-borde-suave pt-3">
                    {datos.map(({ I, t }) => (
                      <li key={t} className="tabular flex items-center gap-1.5 text-sm text-tinta-2">
                        <I size={17} />{t}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="tabular font-bold">
                    {formatPrecio(sel.precio)}
                    {sel.op === "alquiler" && sel.precio !== null && (
                      <span className="text-xs font-normal text-tinta-2"> /mes</span>
                    )}
                  </p>
                  <Link href={sel.url}
                    className="flex items-center gap-1 rounded-full bg-acento px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    Ver <IconChevron size={15} />
                  </Link>
                </div>
              </div>
            </article>
          );
        })()}

      </div>

      {(!hero || zonaActiva) && (
        <div className={`${hero ? "mx-auto max-w-7xl px-5" : ""} mt-4 flex flex-wrap items-baseline justify-between gap-2`}>
          <p className="font-medium">
            {zonaActiva
              ? `${visibles.length} ${visibles.length === 1 ? "inmueble" : "inmuebles"} en la zona que dibujaste`
              : `${visibles.length} inmuebles en el mapa`}
          </p>
          <p className="text-xs text-tinta-3">Ubicación aproximada a nivel de urbanización</p>
        </div>
      )}

      {zonaActiva && (
        <div className={`${hero ? "mx-auto max-w-7xl px-5" : ""} mt-4 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-5`}>
          {visibles.slice(0, 20).map((p) => (
            <Link key={p.id} href={p.url} className="group block">
              <div className="grid aspect-[4/3] place-content-center rounded-card bg-humo text-xs text-tinta-3">
                {TIPO_LABEL[p.tipo].singular}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{p.barrio ?? p.ciudad}</p>
              <p className="tabular truncate text-sm text-tinta-2">{formatPrecio(p.precio)}</p>
            </Link>
          ))}
        </div>
      )}

      {zonaActiva && visibles.length === 0 && (
        <p className={`${hero ? "mx-auto max-w-7xl" : ""} mt-4 rounded-card border border-borde px-5 py-8 text-center text-tinta-2`}>
          No hay inmuebles dentro de esa zona. Prueba a dibujar un área más amplia.
        </p>
      )}
    </div>
  );
}
