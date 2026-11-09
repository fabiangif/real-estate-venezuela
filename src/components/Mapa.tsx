"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// maplibre-gl 6 no expone export default: solo nombrados
import { Map as MapLibre, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import Image from "next/image";
import { formatPrecio, TIPO_LABEL, type Tipo, type Operacion } from "@/lib/types";
import { IconPencil, IconTrash, IconClose, IconBed, IconArea, IconChevron } from "./icons";
import { dentro, cerrarTrazo } from "@/lib/geo";

export type Punto = {
  id: string; lat: number; lng: number;
  precio: number | null; tipo: Tipo; op: Operacion;
  barrio: string | null; ciudad: string;
  hab: number | null; m2: number | null; url: string;
  foto: string | null; // primera foto en el CDN, si la ficha tiene
};

type Coord = [number, number]; // [lng, lat]
type Caja = [Coord, Coord];

/**
 * Mapa base: Positron de OpenFreeMap. Vectorial, sin API key y de uso comercial libre.
 * Antes era el raster de CARTO, que paso a devolver "API KEY REQUIRED" en cada tile.
 * Si este servicio fallara, el estilo es un JSON estandar de MapLibre: se cambia esta URL.
 */
const ESTILO = "https://tiles.openfreemap.org/styles/positron";
/** Tiene que existir en los glyphs del estilo; con otra fuente las etiquetas no se pintan. */
const FUENTE = ["Noto Sans Bold"];
/** Venezuela continental: encuadre de reserva si no hay puntos. */
const VENEZUELA: Caja = [[-73.4, 0.6], [-59.8, 12.3]];
const ACENTO = "#d9480f";
/** Cuantos resultados de una zona se listan bajo el mapa. */
const MAX_LISTA = 24;

const TEXTOS = {
  "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + rueda del ratón para acercar el mapa",
  "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + desplazamiento para acercar el mapa",
  "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
};

/**
 * MapLibre 6 arranca su worker importando una URL resuelta contra import.meta.url,
 * que dentro del bundle de Turbopack no existe: el worker muere en silencio y ninguna
 * fuente llega a teselarse. Se sirve desde public/ (ver scripts/copy-map-worker.mjs).
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const caja = (cs: Coord[]): Caja => {
  const lng = cs.map((c) => c[0]), lat = cs.map((c) => c[1]);
  return [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]];
};
/** Encuadre inicial: los puntos que hay. Con una sola ciudad lanzada, el pais entero seria un mapa vacio. */
const encuadre = (ps: Punto[]): Caja => (ps.length ? caja(ps.map((p) => [p.lng, p.lat])) : VENEZUELA);
/** maxZoom: un unico punto o una zona diminuta no deben acercar hasta el nivel de portal. */
const AJUSTE = { padding: 56, maxZoom: 15 };

const etiqueta = (p: Punto) =>
  p.precio === null ? "Consultar" : p.precio >= 1000 ? `$${Math.round(p.precio / 1000)}k` : `$${p.precio}`;

const aFeature = (p: Punto) => ({
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
  properties: { id: p.id, label: etiqueta(p) },
});

const aZonas = (zonas: Coord[][]) => ({
  type: "FeatureCollection" as const,
  features: zonas.map((z) => ({
    type: "Feature" as const, properties: {},
    geometry: { type: "Polygon" as const, coordinates: [[...z, z[0]]] }, // GeoJSON exige el anillo cerrado
  })),
});

const precioCon = (p: Punto) => (
  <>
    {formatPrecio(p.precio)}
    {p.op === "alquiler" && p.precio !== null && <span className="text-sm font-normal text-tinta-2"> /mes</span>}
  </>
);
const queEs = (p: Punto) => `${TIPO_LABEL[p.tipo].singular} en ${p.op} · ${[p.barrio, p.ciudad].filter(Boolean).join(", ")}`;

/**
 * Mapa del Home con filtro por zonas dibujadas a mano.
 *
 * `alto` son las clases de altura (las comparte con el marcador de carga de MapaHero)
 * y `children` el panel del hero: va arriba del mapa en movil y flotando sobre el en sm+.
 */
export default function Mapa({
  puntos, alto, children,
}: { puntos: Punto[]; alto: string; children?: React.ReactNode }) {
  const cont = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);

  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [dibujando, setDibujando] = useState(false);
  const [trazo, setTrazo] = useState<Coord[] | null>(null); // px en pantalla, solo mientras se dibuja
  const [zonas, setZonas] = useState<Coord[][]>([]);        // lng/lat: ancladas al mapa
  const [filtroOp, setFiltroOp] = useState<"todo" | Operacion>("todo");
  const [sel, setSel] = useState<Punto | null>(null);

  // las zonas se SUMAN entre si y se combinan con el filtro de operacion; derivar en
  // vez de guardar la lista evita que un filtro pise al otro
  const visibles = useMemo(
    () => puntos.filter((p) =>
      (filtroOp === "todo" || p.op === filtroOp) &&
      (!zonas.length || zonas.some((z) => dentro(p.lng, p.lat, z)))),
    [puntos, filtroOp, zonas]
  );
  const zonaActiva = zonas.length > 0;

  const porId = useRef(new Map(puntos.map((p) => [p.id, p])));

  // --- inicializacion del mapa ---
  useEffect(() => {
    if (!cont.current || map.current) return;
    const m = new MapLibre({
      container: cont.current,
      style: ESTILO,
      bounds: encuadre(puntos),
      fitBoundsOptions: AJUSTE,
      attributionControl: { compact: true },
      locale: TEXTOS,
      // El mapa ocupa casi toda la primera pantalla: sin esto la rueda del raton y el
      // dedo quedan atrapados en el y no hay forma de bajar al resto de la pagina.
      cooperativeGestures: true,
      // un mapa de inmuebles no se gira ni se inclina: solo desorienta
      dragRotate: false, pitchWithRotate: false, touchPitch: false,
    });
    map.current = m;
    m.touchZoomRotate.disableRotation();
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
        // las zonas van primero para quedar DEBAJO de los inmuebles
        m.addSource("zonas", { type: "geojson", data: aZonas([]) });
        m.addLayer({ id: "zona-relleno", type: "fill", source: "zonas", paint: { "fill-color": ACENTO, "fill-opacity": 0.1 } });
        m.addLayer({
          id: "zona-borde", type: "line", source: "zonas",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ACENTO, "line-width": 2.5 },
        });

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
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FUENTE, "text-size": 12, "text-allow-overlap": true },
          paint: { "text-color": "#fff" },
        });
        m.addLayer({
          id: "punto", type: "circle", source: "inmuebles", filter: ["!", ["has", "point_count"]],
          paint: { "circle-color": "#fff", "circle-radius": 5, "circle-stroke-width": 2.5, "circle-stroke-color": ACENTO },
        });
        // el seleccionado se rellena: se sabe de un vistazo a que punto pertenece la tarjeta
        m.addLayer({
          id: "punto-sel", type: "circle", source: "inmuebles", filter: ["==", ["get", "id"], ""],
          paint: { "circle-color": ACENTO, "circle-radius": 8, "circle-stroke-width": 3, "circle-stroke-color": "#fff" },
        });
        m.addLayer({
          id: "precio", type: "symbol", source: "inmuebles", filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "label"], "text-font": FUENTE, "text-size": 12,
            "text-offset": [0, -1.4], "text-allow-overlap": false,
          },
          paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 2 },
        });
        // area de toque invisible: un circulo de 5 px no se acierta con el dedo
        m.addLayer({
          id: "punto-toque", type: "circle", source: "inmuebles", filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 18, "circle-opacity": 0 },
        });

        m.on("click", "clusters", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          (m.getSource("inmuebles") as GeoJSONSource)
            .getClusterExpansionZoom(f.properties.cluster_id as number)
            .then((z) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as Coord, zoom: z }));
        });
        m.on("click", "punto-toque", (e) => {
          const id = e.features?.[0]?.properties?.id as string;
          setSel(porId.current.get(id) ?? null);
        });
        // tocar el mapa vacio cierra la tarjeta
        m.on("click", (e) => {
          if (!m.queryRenderedFeatures(e.point, { layers: ["punto-toque", "clusters"] }).length) setSel(null);
        });

        for (const capa of ["clusters", "punto-toque"]) {
          m.on("mouseenter", capa, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", capa, () => (m.getCanvas().style.cursor = ""));
        }
      } catch (err) {
        // sin esto un fallo aqui deja el mapa base pintado y ni un inmueble encima,
        // sin una sola pista de por que
        montadas = false;
        setFallo(true);
        console.error("mapa: no se pudieron montar las capas", err);
      }
    };
    // se intenta en cada evento que pueda dejar el estilo listo; la guarda de arriba
    // hace que solo el primero que llegue haga el trabajo
    for (const ev of ["styledata", "sourcedata", "load", "idle"] as const) m.on(ev, montarCapas);
    montarCapas();

    // Un tile suelto que falla no es noticia; que no llegue el estilo si: sin el no hay mapa.
    m.on("error", (e) => {
      console.error("mapa:", e.error?.message ?? e);
      if (!montadas) setFallo(true);
    });

    // si el estilo tarda, el velo deja de tapar igualmente: mas vale un mapa a medio
    // pintar que un recuadro en blanco
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

  useEffect(() => {
    (map.current?.getSource("zonas") as GeoJSONSource | undefined)?.setData(aZonas(zonas));
  }, [zonas, listo]);

  useEffect(() => {
    const m = map.current;
    if (m?.getLayer("punto-sel")) m.setFilter("punto-sel", ["==", ["get", "id"], sel?.id ?? ""]);
  }, [sel, listo]);

  // al dibujar o quitar zonas el mapa se encuadra en ellas (o vuelve a todos los puntos)
  const zonasVistas = useRef(zonas);
  useEffect(() => {
    if (zonasVistas.current === zonas) return; // montaje: el mapa ya nace encuadrado
    zonasVistas.current = zonas;
    map.current?.fitBounds(zonas.length ? caja(zonas.flat()) : encuadre(puntos), AJUSTE);
  }, [zonas, puntos]);

  // --- dibujo a mano alzada sobre el lienzo ---
  useEffect(() => {
    const m = map.current;
    const el = cont.current;
    if (!m || !el || !dibujando) return;

    // mientras se dibuja el mapa no se mueve, y un dedo dibuja en vez de pedir "usa dos dedos"
    m.dragPan.disable(); m.scrollZoom.disable(); m.doubleClickZoom.disable(); m.touchZoomRotate.disable();
    m.cooperativeGestures.disable();
    m.getCanvas().style.cursor = "crosshair";

    let pts: Coord[] = [];
    let activo = false;

    const punto = (e: PointerEvent): Coord => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button > 0) return; // ni un segundo dedo ni el boton derecho
      activo = true; pts = [punto(e)]; setTrazo(pts);
      el.setPointerCapture(e.pointerId); // el trazo sigue aunque el puntero salga del mapa
    };
    const move = (e: PointerEvent) => {
      if (!activo || !e.isPrimary) return;
      const p = punto(e);
      const u = pts[pts.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 4) return; // no guardar micro-movimientos
      pts = [...pts, p];
      setTrazo(pts);
    };
    const up = (e: PointerEvent) => {
      if (!activo || !e.isPrimary) return;
      activo = false;
      setTrazo(null);
      // Un toque, un garabato o una raya no encierran nada: se ignoran y se sigue en modo
      // dibujo. Lo demas vale tal cual, sin exigir que el trazo cierre: el poligono une
      // el final con el inicio, y `dentro` acepta trazos que se cruzan o dan mas de una vuelta.
      const [[x0, y0], [x1, y1]] = caja(pts);
      if (pts.length < 3 || Math.min(x1 - x0, y1 - y0) < 12) return;
      const zona = cerrarTrazo(pts).map((p) => { const ll = m.unproject(p); return [ll.lng, ll.lat] as Coord; });
      setZonas((z) => [...z, zona]);
      setSel(null);
      setDibujando(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { setTrazo(null); setDibujando(false); } };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    window.addEventListener("keydown", tecla);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", tecla);
      m.dragPan.enable(); m.scrollZoom.enable(); m.doubleClickZoom.enable();
      m.touchZoomRotate.enable(); m.touchZoomRotate.disableRotation();
      m.cooperativeGestures.enable();
      m.getCanvas().style.cursor = "";
    };
  }, [dibujando]);

  const d = trazo?.length ? `M${trazo.map((p) => p.join(",")).join("L")}Z` : "";
  const flotante = "rounded-full border border-borde bg-papel shadow-[var(--shadow-pill)]";
  const n = visibles.length;

  return (
    <div>
      {/* movil: panel arriba y mapa debajo · sm+: el panel flota sobre el mapa */}
      <div className="relative flex flex-col-reverse sm:block">
        <div className="relative overflow-hidden">
          {/* touch-none solo al dibujar: el resto del tiempo un dedo debe poder bajar la pagina */}
          <div ref={cont} className={`w-full ${alto} ${dibujando ? "touch-none" : ""}`} />

          {/* trazo en vivo, por encima del lienzo */}
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            {d && <path d={d} fill={`${ACENTO}1a`} stroke={ACENTO} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
          </svg>

          {/* controles: alineados con la columna de la pagina, no con el borde de la pantalla */}
          <div className="pointer-events-none absolute inset-x-0 top-3">
            <div className="mx-auto max-w-7xl px-3 sm:px-5">
              <div className="pointer-events-auto flex w-fit flex-col items-start gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setDibujando((v) => !v); setTrazo(null); setSel(null); }}
                    aria-pressed={dibujando}
                    className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-[var(--shadow-pill)] transition-colors ${
                      dibujando ? "border-acento bg-acento text-white" : "border-borde bg-papel hover:bg-humo"
                    }`}
                  >
                    <IconPencil size={16} />
                    {dibujando ? "Cancelar" : zonaActiva ? "Agregar otra zona" : "Dibujar zona"}
                  </button>
                  {zonaActiva && !dibujando && (
                    <button onClick={() => { setZonas([]); setSel(null); }}
                      className={`flex min-h-11 items-center gap-2 px-4 text-sm font-medium transition-colors hover:bg-humo ${flotante}`}>
                      <IconTrash size={16} />{zonas.length === 1 ? "Quitar zona" : "Quitar zonas"}
                    </button>
                  )}
                </div>

                <div role="group" aria-label="Operación" className={`flex gap-1 p-1 ${flotante}`}>
                  {([["todo", "Todo"], ["venta", "Venta"], ["alquiler", "Alquiler"]] as const).map(([v, t]) => (
                    <button key={v} onClick={() => { setFiltroOp(v); setSel(null); }}
                      aria-pressed={filtroOp === v}
                      className={`min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors ${
                        filtroOp === v
                          ? v === "alquiler" ? "bg-mar text-white" : v === "venta" ? "bg-acento text-white" : "bg-tinta text-white"
                          : "text-tinta-2 hover:bg-humo"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>

                <p aria-live="polite" className={`px-4 py-2 text-sm font-medium ${flotante}`}>
                  <span className="tabular">{n}</span>{" "}
                  {filtroOp === "venta" ? "en venta" : filtroOp === "alquiler" ? "en alquiler" : n === 1 ? "inmueble" : "inmuebles"}
                  {zonaActiva ? (zonas.length === 1 ? " en tu zona" : " en tus zonas") : " en el mapa"}
                </p>
              </div>
            </div>
          </div>

          {dibujando && (
            <p className="pointer-events-none absolute inset-x-3 bottom-5 mx-auto w-fit rounded-full bg-tinta/90 px-4 py-2 text-center text-xs text-white">
              Mantén pulsado y rodea la zona que te interesa
            </p>
          )}

          {!listo && (
            <div className="absolute inset-0 grid place-content-center bg-humo text-sm text-tinta-2">Cargando mapa…</div>
          )}

          {fallo && (
            <p role="status" className="absolute inset-x-3 bottom-10 mx-auto w-fit max-w-full rounded-full bg-papel px-4 py-2 text-xs text-tinta shadow-[var(--shadow-pill)]">
              No se pudo cargar el mapa base. Revisa tu conexión y recarga la página.
            </p>
          )}

          {/* tarjeta del punto seleccionado: hoja inferior en movil, tarjeta a la derecha en sm+ */}
          {sel && (
            <article className="absolute inset-x-3 bottom-3 flex overflow-hidden rounded-card border border-borde bg-papel shadow-[var(--shadow-pill-hover)] sm:inset-x-auto sm:bottom-11 sm:right-4 sm:w-[25rem]">
              {sel.foto && (
                <div className="relative w-28 shrink-0 bg-humo sm:w-36">
                  <Image src={sel.foto} alt="" fill sizes="144px" className="object-cover" />
                </div>
              )}
              <div className="relative min-w-0 flex-1 p-4">
                <button onClick={() => setSel(null)} aria-label="Cerrar"
                  className="absolute right-2 top-2 grid size-9 place-content-center rounded-full text-tinta-2 transition-colors hover:bg-humo hover:text-tinta">
                  <IconClose size={16} />
                </button>
                <p className="tabular truncate pr-9 text-xl font-extrabold tracking-[-0.02em]">{precioCon(sel)}</p>
                <p className="mt-0.5 truncate text-sm text-tinta-2">{queEs(sel)}</p>
                {(sel.hab || sel.m2) && (
                  <ul className="tabular mt-2 flex items-center gap-x-4 text-sm">
                    {sel.hab && <li className="flex items-center gap-1.5"><IconBed size={17} className="text-tinta-2" />{sel.hab}<span className="sr-only">habitaciones</span></li>}
                    {sel.m2 && <li className="flex items-center gap-1.5"><IconArea size={17} className="text-tinta-2" />{sel.m2} m²</li>}
                  </ul>
                )}
                <Link href={sel.url}
                  className="mt-3 flex min-h-11 w-fit items-center gap-1 rounded-full bg-acento px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                  Ver inmueble <IconChevron size={15} />
                </Link>
              </div>
            </article>
          )}
        </div>

        {/* el panel del hero se aparta (solo donde flota) en cuanto hay algo que mirar */}
        {children && <div className={sel || dibujando || zonaActiva ? "sm:invisible" : ""}>{children}</div>}
      </div>

      {zonaActiva && (
        <section aria-label="Inmuebles en la zona dibujada" className="mx-auto max-w-7xl px-5 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {n} {n === 1 ? "inmueble" : "inmuebles"} en {zonas.length === 1 ? "la zona que dibujaste" : `las ${zonas.length} zonas que dibujaste`}
            </h2>
            <p className="text-xs text-tinta-2">Ubicación aproximada a nivel de urbanización</p>
          </div>

          {n === 0 ? (
            <p className="mt-4 rounded-card border border-borde px-5 py-8 text-center text-tinta-2">
              No hay inmuebles dentro de esa zona. Prueba a dibujar un área más amplia.
            </p>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibles.slice(0, MAX_LISTA).map((p) => (
                  <li key={p.id}>
                    <Link href={p.url}
                      className="flex items-center gap-3 rounded-card border border-borde p-3 transition-colors hover:border-tinta hover:bg-humo">
                      <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-humo">
                        {p.foto && <Image src={p.foto} alt="" fill sizes="80px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="tabular block truncate text-lg font-bold">{precioCon(p)}</span>
                        <span className="tabular block text-sm">
                          {[p.hab && `${p.hab} hab`, p.m2 && `${p.m2} m²`].filter(Boolean).join(" · ") || " "}
                        </span>
                        <span className="block truncate text-sm text-tinta-2">{queEs(p)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {n > MAX_LISTA && (
                <p className="mt-4 text-sm text-tinta-2">
                  Se muestran {MAX_LISTA} de {n}. Dibuja una zona más pequeña o toca los puntos del mapa para ver el resto.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
