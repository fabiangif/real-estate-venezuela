const ALIASES: [RegExp, string][] = [
  [/\b(?:apartamentos?|aptos?)\b/g, "apartamento"],
  [/\bcasas\b/g, "casa"],
  [/\bquintas\b/g, "quinta"],
  [/\btownhouses\b/g, "townhouse"],
  [/\bpenthouses\b/g, "penthouse"],
  [/\banexos\b/g, "anexo"],
  [/\boficinas\b/g, "oficina"],
  [/\blocales(?: comerciales)?\b/g, "local"],
  [/\bterrenos\b/g, "terreno"],
  [/\bgalpones\b/g, "galpon"],
  [/\b(?:comprar|compra|compras|ventas?)\b/g, "venta"],
  [/\b(?:alquilar|alquileres|arrendar|arriendos?)\b/g, "alquiler"],
  [/\b(?:habitaciones?|dormitorios?|cuartos?|habs?)\b/g, "habitacion"],
  [/\bbanos?\b/g, "bano"],
  [/\b(?:estacionamientos?|puestos? de estacionamiento|garajes?)\b/g, "estacionamiento"],
  [/\b(?:metros? cuadrados?|m2|mt2|mts2)\b/g, "m2"],
  [/\b(?:amueblado|amueblada|amoblada)\b/g, "amoblado"],
  [/\b(?:mascotas?|pet friendly)\b/g, "petfriendly"],
];

const PALABRAS_VACIAS = new Set([
  "a", "al", "de", "del", "el", "en", "la", "las", "los", "o", "para", "por", "que", "un", "una", "y",
  "con", "inmueble", "inmuebles", "propiedad", "propiedades", "buscar", "quiero", "ver",
]);

/**
 * Normalización compartida entre el buscador del navegador y el motor del servidor.
 * Convierte sinónimos frecuentes a un vocabulario estable sin tocar el texto visible.
 */
export function normalizarTexto(texto: string): string {
  let valor = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/.-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [patron, reemplazo] of ALIASES) valor = valor.replace(patron, reemplazo);
  return valor.replace(/\s+/g, " ").trim();
}

export function terminosBusqueda(texto: string): string[] {
  return [...new Set(
    normalizarTexto(texto)
      .split(" ")
      .filter((termino) => termino.length > 1 && !PALABRAS_VACIAS.has(termino))
      .slice(0, 12)
  )];
}
