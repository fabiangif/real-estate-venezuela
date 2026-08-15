/**
 * Comprueba qué fotos existen realmente en Cloudflare R2 y genera el manifiesto
 * que consume scripts/import.ts. No necesita ni almacena credenciales: consulta
 * únicamente la URL pública del bucket.
 *
 * Uso: npm run sync:cdn
 * Con un inventario de R2: R2_INVENTORY_PATH=/ruta/inventory.json npm run sync:cdn
 * Para cambiar de dominio: CDN_BASE_URL=https://fotos.ejemplo.com npm run sync:cdn
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DEFAULT_CDN_BASE_URL = "https://pub-0396125c6071462aa9f92fbcb727652c.r2.dev";
const CDN_BASE_URL = (process.env.CDN_BASE_URL ?? DEFAULT_CDN_BASE_URL).replace(/\/$/, "");
const CONCURRENCY = 24;

type RawListing = Record<string, unknown>;
type RemoteImage = { url: string; etag: string | null };
type InventoryItem = {
  Path: string;
  Name: string;
  Size: number;
  MimeType?: string;
  IsDir?: boolean;
};
type Property = {
  city: string;
  profile: string;
  shortcode: string;
  photoCount: number;
};

const raw = JSON.parse(
  readFileSync(join(ROOT, "data", "raw", "Inmuebles.json"), "utf8"),
) as RawListing[];

const properties = new Map<string, Property>();
for (const row of raw) {
  const city = String(row["Ciudad"] ?? "").trim();
  const profile = String(row["Perfil IG"] ?? "").trim();
  const shortcode = /\/p\/([^/]+)\/?/.exec(String(row["URL del Post"] ?? ""))?.[1];
  if (!city || !profile || !shortcode) continue;

  const parsedCount = Number(row["Cant. Fotos"] ?? 0);
  const photoCount = Number.isFinite(parsedCount) ? Math.max(0, Math.floor(parsedCount)) : 0;
  const current = properties.get(shortcode);
  if (!current || photoCount > current.photoCount) {
    properties.set(shortcode, { city, profile, shortcode, photoCount });
  }
}

function publicUrl(folder: string, filename: string): string {
  return `${CDN_BASE_URL}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
}

function publicObjectUrl(path: string): string {
  return `${CDN_BASE_URL}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function candidates(property: Property): string[] {
  const shortcodes = [property.shortcode];
  const normalized = property.shortcode.replace(/_+$/, "");
  if (normalized && normalized !== property.shortcode) shortcodes.push(normalized);

  const urls: string[] = [];
  for (const folderShortcode of shortcodes) {
    for (const filenameShortcode of shortcodes) {
      const folder = `${property.city}_${property.profile}_${folderShortcode}`;
      const basename = `${property.profile}_${filenameShortcode}`;
      urls.push(publicUrl(folder, `${basename}.jpg`));
      for (let i = 1; i <= property.photoCount; i++) {
        urls.push(publicUrl(folder, `${basename}_${i}.jpg`));
      }
    }
  }
  return [...new Set(urls)];
}

async function probe(url: string): Promise<RemoteImage | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (response.ok && response.headers.get("content-type")?.startsWith("image/")) {
        return {
          url,
          etag: response.headers.get("etag"),
        };
      }
      if (response.status !== 429 && response.status < 500) return null;
    } catch {
      // Un fallo transitorio de red se reintenta abajo.
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
  }
  return null;
}

function withoutDuplicateFirstImage(images: RemoteImage[]): string[] {
  if (images.length < 2) return images.map((image) => image.url);
  const [first, second] = images;
  const sameEtag = first.etag && second.etag && first.etag === second.etag;
  return (sameEtag ? [first, ...images.slice(2)] : images).map((image) => image.url);
}

function photoOrder(name: string): number {
  const numbered = /_(\d+)\.(?:jpe?g|png|webp)$/i.exec(name);
  return numbered ? Number(numbered[1]) : 0;
}

function writeManifest(imagesByShortcode: Record<string, string[]>) {
  const totalImages = Object.values(imagesByShortcode).reduce((total, images) => total + images.length, 0);
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: CDN_BASE_URL,
    totalProperties: properties.size,
    propertiesWithImages: Object.keys(imagesByShortcode).length,
    totalImages,
    imagesByShortcode,
  };

  writeFileSync(join(ROOT, "data", "cdn-images.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Manifiesto listo: ${manifest.propertiesWithImages.toLocaleString("es-VE")}/${manifest.totalProperties.toLocaleString("es-VE")} propiedades, ` +
    `${totalImages.toLocaleString("es-VE")} imágenes.`,
  );
}

function fromInventory(inventoryPath: string) {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as InventoryItem[];
  const byFolder = new Map<string, InventoryItem[]>();
  for (const item of inventory) {
    if (item.IsDir) continue;
    const separator = item.Path.indexOf("/");
    if (separator < 0) continue;
    const folder = item.Path.slice(0, separator);
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), item]);
  }

  const imagesByShortcode: Record<string, string[]> = {};
  for (const property of properties.values()) {
    const shortcodes = [...new Set([property.shortcode, property.shortcode.replace(/_+$/, "")])].filter(Boolean);
    const folder = shortcodes
      .map((shortcode) => `${property.city}_${property.profile}_${shortcode}`)
      .find((candidate) => byFolder.has(candidate));
    if (!folder) continue;

    const images = (byFolder.get(folder) ?? [])
      .filter((item) => item.MimeType?.startsWith("image/") || /\.(?:jpe?g|png|webp)$/i.test(item.Name))
      .sort((a, b) => photoOrder(a.Name) - photoOrder(b.Name) || a.Name.localeCompare(b.Name));
    if (!images.length) continue;

    const [first, second] = images;
    const duplicateFirst = Boolean(
      second &&
      second.Name === first.Name.replace(/(\.[^.]+)$/, "_1$1") &&
      second.Size === first.Size,
    );
    const unique = duplicateFirst ? [first, ...images.slice(2)] : images;
    imagesByShortcode[property.shortcode] = unique.map((item) => publicObjectUrl(item.Path));
  }

  console.log(`Inventario R2 leído: ${inventory.length.toLocaleString("es-VE")} objetos.`);
  writeManifest(imagesByShortcode);
}

async function main() {
  const inventoryPath = process.env.R2_INVENTORY_PATH;
  if (inventoryPath && existsSync(inventoryPath)) {
    fromInventory(inventoryPath);
    return;
  }

  const work = [...properties.values()].flatMap((property) =>
    candidates(property).map((url) => ({ shortcode: property.shortcode, url })),
  );
  const found = new Map<string, RemoteImage[]>();
  let cursor = 0;
  let completed = 0;

  console.log(`Comprobando ${work.length.toLocaleString("es-VE")} posibles imágenes en R2…`);
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= work.length) return;
      const item = work[index];
      const image = await probe(item.url);
      if (image) found.set(item.shortcode, [...(found.get(item.shortcode) ?? []), image]);
      completed++;
      if (completed % 500 === 0 || completed === work.length) {
        console.log(`  ${completed.toLocaleString("es-VE")}/${work.length.toLocaleString("es-VE")}`);
      }
    }
  });
  await Promise.all(workers);

  const imagesByShortcode: Record<string, string[]> = {};
  for (const property of properties.values()) {
    const order = new Map(candidates(property).map((url, index) => [url, index]));
    const images = (found.get(property.shortcode) ?? [])
      .sort((a, b) => (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
    const unique = withoutDuplicateFirstImage(images);
    if (unique.length) imagesByShortcode[property.shortcode] = unique;
  }

  writeManifest(imagesByShortcode);
}

await main();
