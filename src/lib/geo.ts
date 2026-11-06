/**
 * Punto en poligono por NUMERO DE VUELTAS (regla "nonzero"): true si el trazo rodea al punto.
 *
 * No se usa par-impar (ray casting) porque la zona la dibuja una persona a mano: al
 * cerrar un circulo casi siempre se pasa del inicio y el trazo se cruza consigo mismo.
 * Con par-impar ese solape quedaria "fuera" y desaparecerian inmuebles que el usuario
 * claramente rodeo. Con numero de vueltas, todo lo rodeado cuenta: solapes, ochos y espirales.
 *
 * 12 lineas frente a los ~80 KB de turf.js para una sola funcion.
 * Vive aparte de Mapa.tsx para poder probarse sin arrastrar MapLibre.
 */
/**
 * Recorta la cola de un trazo a mano que vuelve a pasar por su inicio.
 *
 * Al cerrar un circulo casi nadie se detiene justo donde empezo: se pasa unos grados.
 * Sin recortar, esa cola dibuja una cuerda y una cuña mas oscura sobre la zona.
 * El trazo se corta la primera vez que regresa a menos de `cerca` px del inicio
 * despues de haberse alejado. Un trazo que no vuelve se deja como esta.
 *
 * ponytail: solo detecta la vuelta al PUNTO inicial. Si el trazo se cruza lejos de el
 * (un lazo con las puntas cruzadas) no se recorta: `dentro` lo sigue resolviendo bien
 * y solo queda una pestaña visible. Mejora posible: cortar en la autointerseccion.
 */
export function cerrarTrazo(pts: [number, number][], cerca = 16): [number, number][] {
  const lejos = (p: [number, number]) => Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
  const salio = pts.findIndex((p) => lejos(p) > cerca * 3);
  if (salio < 0) return pts;
  const volvio = pts.findIndex((p, i) => i > salio && lejos(p) < cerca);
  return volvio < 0 ? pts : pts.slice(0, volvio + 1);
}

export function dentro(lng: number, lat: number, poly: [number, number][]): boolean {
  let vueltas = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xj, yj] = poly[j];
    const [xi, yi] = poly[i];
    // > 0 si el punto queda a la izquierda de la arista j -> i
    const lado = (xi - xj) * (lat - yj) - (lng - xj) * (yi - yj);
    if (yj <= lat) { if (yi > lat && lado > 0) vueltas++; }
    else if (yi <= lat && lado < 0) vueltas--;
  }
  return vueltas !== 0;
}
