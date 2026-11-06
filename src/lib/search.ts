import { LISTINGS, LOCATIONS, porRelevancia } from "./data";
import { TIPO_LABEL, type Listing } from "./types";
import { normalizarTexto, terminosBusqueda } from "./search-core";

const AMENIDAD_LABEL: Record<string, string> = {
  tanque_agua: "tanque de agua",
  planta_electrica: "planta eléctrica",
  vigilancia_24h: "vigilancia 24 horas",
  piscina: "piscina",
  parrillera: "parrillera",
  area_social: "área social",
  parque_infantil: "parque infantil",
  cancha: "cancha",
  gimnasio: "gimnasio",
  ascensor: "ascensor",
  lavanderia: "lavandería",
  pet_friendly: "pet friendly",
};

const textoAmenidad = (amenidad: string) => AMENIDAD_LABEL[amenidad] ?? amenidad.replaceAll("_", " ");

function documento(listing: Listing) {
  const tipo = TIPO_LABEL[listing.tipo];
  const caracteristicas = [
    listing.habitaciones && `${listing.habitaciones} habitaciones dormitorios cuartos`,
    listing.banos && `${listing.banos} baños`,
    listing.estacionamientos && `${listing.estacionamientos} estacionamientos garajes`,
    listing.m2 && `${listing.m2} m2 metros cuadrados`,
    listing.areaTerreno && `${listing.areaTerreno} m2 terreno`,
    listing.amoblado === true && "amoblado amueblado",
    listing.amoblado === false && "sin amoblar no amoblado",
  ].filter(Boolean);

  const estructurado = normalizarTexto([
    listing.operacion,
    tipo.singular,
    tipo.plural,
    listing.estadoNombre,
    listing.ciudadNombre,
    listing.barrioNombre,
    ...caracteristicas,
    ...listing.amenidades.map(textoAmenidad),
  ].filter(Boolean).join(" "));

  return {
    estructurado,
    completo: normalizarTexto([estructurado, listing.titulo, listing.descripcion].filter(Boolean).join(" ")),
  };
}

const DOCUMENTOS = LISTINGS.map((listing) => ({
  listing,
  ...documento(listing),
}));

const VOCABULARIO_ESTRUCTURADO = new Set([
  "venta", "alquiler", "habitacion", "bano", "estacionamiento", "m2", "amoblado", "petfriendly",
  ...LISTINGS.flatMap((listing) => terminosBusqueda([
    TIPO_LABEL[listing.tipo].singular,
    TIPO_LABEL[listing.tipo].plural,
    listing.estadoNombre,
    listing.ciudadNombre,
    listing.barrioNombre,
    ...listing.amenidades.map(textoAmenidad),
  ].filter(Boolean).join(" "))),
]);

/** Búsqueda AND: cada término significativo debe existir en la ficha normalizada. */
export function buscarTexto(query: string): Listing[] {
  const terminos = terminosBusqueda(query);
  if (!terminos.length) return [];
  const tieneCantidad = terminos.some((termino) =>
    ["habitacion", "bano", "estacionamiento", "m2"].includes(termino)
  );

  return DOCUMENTOS
    .filter(({ estructurado, completo }) => {
      const palabrasEstructuradas = new Set(estructurado.split(" "));
      const palabrasCompletas = new Set(completo.split(" "));
      return terminos.every((termino) => {
        const esEstructurado = VOCABULARIO_ESTRUCTURADO.has(termino) || (tieneCantidad && /^\d+$/.test(termino));
        return (esEstructurado ? palabrasEstructuradas : palabrasCompletas).has(termino);
      });
    })
    .sort((a, b) => porRelevancia(a.listing, b.listing))
    .map(({ listing }) => listing);
}

let cacheSugerencias: string[] | undefined;

/**
 * Opciones reales para el combobox. Las primeras funcionan como ejemplos al enfocar;
 * el resto permite autocompletar ubicaciones, tipos y amenidades del inventario.
 */
export function sugerenciasBusqueda(): string[] {
  if (cacheSugerencias) return cacheSugerencias;
  // los ejemplos nombran la ciudad con mas inventario PUBLICADO: con el lanzamiento
  // escalonado, sugerir una ciudad sin lanzar llevaria a cero resultados
  const ciudad = LOCATIONS[0]?.ciudades[0]?.nombre;
  const sugerencias = [
    ...(ciudad ? [`Apartamentos en venta en ${ciudad}`] : []),
    "Casas con piscina",
    ...(ciudad ? [`Alquileres en ${ciudad}`] : []),
    "Apartamentos de 3 habitaciones",
    "Inmuebles con planta eléctrica",
  ];

  for (const estado of LOCATIONS) {
    sugerencias.push(estado.nombre);
    for (const ciudad of estado.ciudades) {
      sugerencias.push(`${ciudad.nombre}, ${estado.nombre}`);
      for (const barrio of ciudad.barrios.slice(0, 8)) {
        sugerencias.push(`${barrio.nombre}, ${ciudad.nombre}`);
      }
    }
  }

  for (const tipo of new Set(LISTINGS.map((listing) => listing.tipo))) {
    sugerencias.push(TIPO_LABEL[tipo].plural);
  }

  for (const amenidad of new Set(LISTINGS.flatMap((listing) => listing.amenidades))) {
    sugerencias.push(`Con ${textoAmenidad(amenidad)}`);
  }

  cacheSugerencias = [...new Map(sugerencias.map((valor) => [normalizarTexto(valor), valor])).values()];
  return cacheSugerencias;
}
