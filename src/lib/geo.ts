/**
 * Ray casting: true si el punto cae dentro del poligono.
 * 12 lineas frente a los ~80 KB de turf.js para una sola funcion.
 * Vive aparte de Mapa.tsx para poder probarse sin arrastrar MapLibre.
 */
export function dentro(lng: number, lat: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
