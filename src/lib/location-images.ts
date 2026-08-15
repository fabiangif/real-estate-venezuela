import type { Listing } from "./types";

export type LocationImage = {
  src: string;
  alt: string;
  city: string;
  credit: string;
  source: string;
  license: string;
  licenseUrl: string;
  objectPosition: string;
};

/**
 * Una sola fuente de verdad para las imágenes geográficas del sitio.
 * Los barrios heredan la foto de su ciudad y los estados la de su capital
 * disponible en el inventario actual.
 */
export const LOCATION_IMAGES: Record<string, LocationImage> = {
  caracas: {
    src: "/ciudades/caracas.jpg",
    alt: "Caracas al pie del Ávila durante el atardecer",
    city: "Caracas",
    credit: "Bona Lee",
    source: "https://unsplash.com/photos/a-view-of-a-city-with-mountains-in-the-background-8Pm2WioMBBQ",
    license: "Unsplash",
    licenseUrl: "https://unsplash.com/license",
    objectPosition: "center 62%",
  },
  barquisimeto: {
    src: "/ciudades/barquisimeto.jpg",
    alt: "Atardecer dorado sobre Barquisimeto, estado Lara",
    city: "Barquisimeto",
    credit: "María Eva Castillo",
    source: "https://commons.wikimedia.org/wiki/File:Atardecer_desde_la_Flor_de_Venezuela,_Barquisimeto,_Lara..JPG",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    objectPosition: "center 70%",
  },
  maracaibo: {
    src: "/ciudades/maracaibo.jpg",
    alt: "Puente General Rafael Urdaneta sobre el lago de Maracaibo",
    city: "Maracaibo",
    credit: "Franklin Canelon",
    source: "https://unsplash.com/photos/a-view-of-a-very-tall-bridge-with-a-sky-background-t3MkmDl_cdQ",
    license: "Unsplash",
    licenseUrl: "https://unsplash.com/license",
    objectPosition: "center 58%",
  },
  maracay: {
    src: "/ciudades/maracay.jpg",
    alt: "Vista reciente del centro urbano de Maracay, estado Aragua",
    city: "Maracay",
    credit: "Lacamaradefran",
    source: "https://commons.wikimedia.org/wiki/File:Ciudad_de_Maracay_2025-9238.jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    objectPosition: "center 58%",
  },
  valencia: {
    src: "/ciudades/valencia.jpg",
    alt: "Panorámica de Valencia y sus montañas desde Las Chimeneas",
    city: "Valencia",
    credit: "Angeelangelw",
    source: "https://commons.wikimedia.org/wiki/File:Vista_de_la_ciudad_desde_las_urbanizacion_las_chimeneas..jpg",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    objectPosition: "center center",
  },
};

const IMAGE_BY_STATE: Record<string, string> = {
  "distrito-capital": "caracas",
  lara: "barquisimeto",
  zulia: "maracaibo",
  aragua: "maracay",
  carabobo: "valencia",
};

export function locationImage(ciudadSlug?: string, estadoSlug?: string) {
  if (ciudadSlug && LOCATION_IMAGES[ciudadSlug]) return LOCATION_IMAGES[ciudadSlug];
  const ciudadDelEstado = estadoSlug ? IMAGE_BY_STATE[estadoSlug] : undefined;
  return ciudadDelEstado ? LOCATION_IMAGES[ciudadDelEstado] : undefined;
}

/** Solo muestra un hero geográfico cuando todos los resultados apuntan a la misma ciudad. */
export function locationImageForListings(listings: Listing[]) {
  const ciudades = new Set(listings.map((listing) => listing.ciudad));
  return ciudades.size === 1 ? LOCATION_IMAGES[[...ciudades][0]] : undefined;
}
