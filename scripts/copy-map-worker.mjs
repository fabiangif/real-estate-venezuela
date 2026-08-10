/**
 * Copia el worker de MapLibre a public/maplibre/.
 *
 * MapLibre 6 arranca su worker con un Blob que hace `import` de una URL resuelta
 * contra import.meta.url. Dentro del bundle de Turbopack esa URL no existe: el
 * worker muere en silencio y, sin worker, ninguna fuente GeoJSON se tesela — el
 * mapa base raster se ve, pero no aparece un solo inmueble encima y no hay error.
 *
 * Sirviendo el worker como fichero propio y apuntando setWorkerUrl() ahi, funciona.
 * Se copia en cada build para que no se quede desfasado al actualizar la libreria.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// el paquete solo exporta "." como ESM y "./package.json": se resuelve por ahi
const dist = join(dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")), "dist");
const destino = join(import.meta.dirname, "..", "public", "maplibre");
mkdirSync(destino, { recursive: true });

// el worker importa el shared de forma relativa: los dos tienen que viajar juntos
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, f), join(destino, f));
}
console.log("worker de MapLibre copiado a public/maplibre/");
