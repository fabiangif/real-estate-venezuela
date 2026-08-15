/**
 * Check runnable de la lógica que no es trivial. Sin framework, sin fixtures.
 * Si algo de esto se rompe, el sitio publica data incorrecta en silencio.
 *
 * Uso: npm run check
 */
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../src/lib/types.ts";
import { normalizarTexto, terminosBusqueda } from "../src/lib/search-core.ts";
import { LOCATION_IMAGES, locationImage } from "../src/lib/location-images.ts";
import { dentro } from "../src/lib/geo.ts";
import { e164, titleCase, redondear, deduplicar } from "./import.ts";
import type { Listing } from "../src/lib/types.ts";

let n = 0;
const test = (nombre: string, fn: () => void) => {
  try { fn(); n++; }
  catch (e) { console.error(`✗ ${nombre}\n  ${(e as Error).message}`); process.exitCode = 1; }
};

test("slugify quita acentos y espacios", () => {
  assert.equal(slugify("El Viñedo"), "el-vinedo");
  assert.equal(slugify("  Los Palos Grandes "), "los-palos-grandes");
  assert.equal(slugify("La Trigaleña"), "la-trigalena");
  assert.equal(slugify("Zona Industrial II"), "zona-industrial-ii");
});

test("la búsqueda unifica sinónimos, acentos y palabras vacías", () => {
  assert.equal(normalizarTexto("APTOS con 3 hab. y planta eléctrica"), "apartamento con 3 habitacion y planta electrica");
  assert.deepEqual(
    terminosBusqueda("Quiero apartamentos en alquiler en Caracas con piscina"),
    ["apartamento", "alquiler", "caracas", "piscina"]
  );
});

test("cada ciudad y estado publicado tiene una imagen local relacionada", () => {
  const locations = JSON.parse(
    readFileSync(join(process.cwd(), "data", "locations.json"), "utf8")
  ) as { slug: string; ciudades: { slug: string }[] }[];

  for (const estado of locations) {
    assert.ok(locationImage(undefined, estado.slug), `falta imagen para el estado ${estado.slug}`);
    for (const ciudad of estado.ciudades) {
      const image = LOCATION_IMAGES[ciudad.slug];
      assert.ok(image, `falta imagen para la ciudad ${ciudad.slug}`);
      assert.ok(existsSync(join(process.cwd(), "public", image.src)), `no existe ${image.src}`);
    }
  }
});

test("e164 acepta móviles venezolanos y rechaza el resto", () => {
  assert.equal(e164("0412-1234567"), "+584121234567");
  assert.equal(e164("+58 414 123 45 67"), "+584141234567");
  assert.equal(e164("4261234567"), "+584261234567");
  assert.equal(e164("0212-1234567"), null, "fijo de Caracas no es WhatsApp");
  assert.equal(e164("12345"), null);
  assert.equal(e164(null), null);
});

test("titleCase unifica el nombre del barrio", () => {
  assert.equal(titleCase("LA CASTELLANA"), "La Castellana");
  assert.equal(titleCase("terra mia"), "Terra Mia");
  assert.equal(titleCase("parque LA musica"), "Parque la Musica");
  assert.equal(titleCase("zona industrial II"), "Zona Industrial II", "los romanos se quedan en mayúscula");
});

test("redondear elimina el ruido de decimales del área", () => {
  assert.equal(redondear(371.06), 371);
  assert.equal(redondear(47.74), 48);
  assert.equal(redondear(null), null);
});

test("dentro resuelve punto en polígono", () => {
  const cuadrado: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  assert.equal(dentro(0, 0, cuadrado), true, "el centro está dentro");
  assert.equal(dentro(2, 0, cuadrado), false, "fuera por la derecha");
  assert.equal(dentro(0, 5, cuadrado), false, "fuera por arriba");
  // cóncavo en forma de C: el hueco NO cuenta como dentro
  const c: [number, number][] = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [4, 3], [4, 4], [0, 4]];
  assert.equal(dentro(0.5, 2, c), true, "en el lomo de la C");
  assert.equal(dentro(3, 2, c), false, "en el hueco de la C");
});

test("deduplicar conserva la publicación más completa", () => {
  const base = {
    operacion: "venta", tipo: "apartamento", estado: "lara", estadoNombre: "Lara",
    ciudad: "barquisimeto", ciudadNombre: "Barquisimeto", barrio: "del-este", barrioNombre: "Del Este",
    precio: 45000, m2: 90, habitaciones: 3, banos: 2, estacionamientos: null, areaTerreno: null,
    amoblado: null, amenidades: [], whatsapp: null, fotos: [], fotosCount: 0,
    videos: [], videosCount: 0, titulo: "t", slug: "s",
    fuente: { handle: null, postUrl: null, driveUrl: null },
    dataQuality: "completo", indexable: true,
  } as unknown as Listing;

  const pobre = { ...base, publicId: "a-venta", fotosCount: 1, descripcion: "corta" };
  const rica = { ...base, publicId: "b-venta", fotosCount: 9, descripcion: "descripción mucho más larga" };
  const otra = { ...base, publicId: "c-venta", precio: 99000 };

  const { unicas, retirados } = deduplicar([pobre, rica, otra]);
  assert.equal(retirados, 1);
  assert.equal(unicas.length, 2);
  assert.ok(unicas.some((l) => l.publicId === "b-venta"), "sobrevive la de más fotos");
  assert.ok(!unicas.some((l) => l.publicId === "a-venta"));
  assert.ok(unicas.some((l) => l.publicId === "c-venta"), "distinto precio => inmueble distinto");
});

test("deduplicar no agrupa fichas sin nada que las distinga", () => {
  const vacio = {
    operacion: "venta", tipo: "casa", ciudad: "caracas", barrio: null,
    precio: null, m2: null, habitaciones: null, banos: null,
    amenidades: [], fotosCount: 0, descripcion: null,
  } as unknown as Listing;
  const { unicas, retirados } = deduplicar([
    { ...vacio, publicId: "x-venta" },
    { ...vacio, publicId: "y-venta" },
  ]);
  assert.equal(retirados, 0, "sin precio ni área podrían ser inmuebles realmente distintos");
  assert.equal(unicas.length, 2);
});

test("los medios publicados son URLs verificadas y no hay fichas indexables sin contenido visual", () => {
  const listings = JSON.parse(
    readFileSync(join(process.cwd(), "data", "listings.json"), "utf8")
  ) as Listing[];
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "data", "cdn-images.json"), "utf8")
  ) as { baseUrl: string };
  const cdnOrigin = new URL(manifest.baseUrl).origin;

  for (const listing of listings) {
    assert.equal(listing.fotosCount, listing.fotos.length, `${listing.publicId}: contador incorrecto`);
    assert.equal(listing.videosCount, listing.videos.length, `${listing.publicId}: contador de videos incorrecto`);
    assert.equal(new Set(listing.fotos).size, listing.fotos.length, `${listing.publicId}: fotos duplicadas`);
    assert.equal(new Set(listing.videos).size, listing.videos.length, `${listing.publicId}: videos duplicados`);
    for (const medio of [...listing.fotos, ...listing.videos]) {
      const url = new URL(medio);
      assert.equal(url.protocol, "https:", `${listing.publicId}: el medio no usa HTTPS`);
      assert.equal(url.origin, cdnOrigin, `${listing.publicId}: origen CDN inesperado`);
    }
    if (listing.indexable) {
      assert.ok(listing.fotos.length + listing.videos.length > 0, `${listing.publicId}: indexable sin medio real`);
    }
  }
});

if (!process.exitCode) console.log(`${n}/${n} checks OK`);
