import { ImageResponse } from "next/og";
import { TIPO_LABEL, OPERACION_LABEL, formatPrecio } from "@/lib/types";
import { byId, tipoPorSlug } from "@/lib/data";
import { parseListado, tituloListado } from "@/app/[...ruta]/listado";

/**
 * Miniatura para WhatsApp y redes, generada bajo demanda.
 *
 * Importa mas de lo que parece: el unico canal de conversion del portal es WhatsApp,
 * y hasta ahora cada enlace reenviado llegaba sin imagen, sin titulo y sin precio.
 * Como el inventario todavia no tiene fotos, esta tarjeta ES la imagen del inmueble.
 *
 * Bajo demanda y no en el build: precomputar ~2.000 imagenes alargaria cada build
 * varios minutos para algo que el CDN cachea igual tras la primera peticion.
 *
 * El contenido se DERIVA de la data a partir del id o de la ruta; nunca se pinta
 * texto libre que venga en la query.
 */
const size = { width: 1200, height: 630 };

const ACENTO = "#d9480f";
const TINTA = "#16130f";
const TINTA2 = "#6b655c";

const Marco = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    justifyContent: "space-between", background: "#fdf7f3", padding: 72,
    fontFamily: "sans-serif", borderBottom: `18px solid ${ACENTO}`,
  }}>
    {children}
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 700, color: TINTA }}>
      <div style={{ display: "flex", width: 22, height: 22, background: ACENTO, borderRadius: 6 }} />
      <span>Inmuebles</span><span style={{ color: ACENTO }}>VE</span>
    </div>
  </div>
);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  // --- ficha: el precio manda, es lo que decide si abren el enlace ---
  const l = q.get("id") ? byId.get(q.get("id")!) : undefined;
  if (l) {
    const datos = [
      l.habitaciones && `${l.habitaciones} hab`,
      l.banos && `${l.banos} ${l.banos === 1 ? "baño" : "baños"}`,
      l.m2 && `${l.m2} m²`,
    ].filter(Boolean).join("   ·   ");

    return new ImageResponse(
      (
        <Marco>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, color: ACENTO, fontWeight: 700, letterSpacing: 1 }}>
              {`${TIPO_LABEL[l.tipo].singular} en ${OPERACION_LABEL[l.operacion]}`.toUpperCase()}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 92, fontWeight: 800, color: TINTA, lineHeight: 1 }}>{formatPrecio(l.precio)}</span>
              {l.operacion === "alquiler" && l.precio !== null && (
                <span style={{ fontSize: 38, color: TINTA2, paddingBottom: 8 }}>/mes</span>
              )}
            </div>
            <div style={{ display: "flex", fontSize: 42, color: TINTA, marginTop: 18 }}>
              {`${l.barrioNombre ? `${l.barrioNombre}, ` : ""}${l.ciudadNombre}`}
            </div>
            {datos && <div style={{ display: "flex", fontSize: 34, color: TINTA2, marginTop: 6 }}>{datos}</div>}
          </div>
        </Marco>
      ), size);
  }

  // --- listado: el conteo es el gancho ---
  const ruta = (q.get("l") ?? "").split("/").filter(Boolean);
  const c = ruta.length ? parseListado(ruta, tipoPorSlug) : null;

  return new ImageResponse(
    (
      <Marco>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {c && (
            <div style={{ display: "flex", fontSize: 30, color: ACENTO, fontWeight: 700, letterSpacing: 1 }}>
              {`${c.todos.length} ${c.todos.length === 1 ? "inmueble disponible" : "inmuebles disponibles"}`.toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", fontSize: c ? 68 : 76, fontWeight: 800, color: TINTA, lineHeight: 1.12, maxWidth: 1000 }}>
            {c ? tituloListado(c) : "Portal inmobiliario de Venezuela"}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: TINTA2 }}>
            Precios en dólares y contacto directo por WhatsApp
          </div>
        </div>
      </Marco>
    ), size);
}
