# Roadmap de acción — Portal Inmobiliario Venezuela (v1)

**Estado:** especificación pendiente de aprobación. Nada construido todavía.
**Fuentes:** `Doc_Tecnico_Developer_Inmuebles_Venezuela_v1.md` + `Estudio_pSEO_Inmuebles_Venezuela.pdf`
**Cambio declarado por el cliente:** la data no llega por scraper en vivo, llega por **CSV → JSON**.

---

## 0. Lo que estamos construyendo (en una frase)

Un sitio estático de inmuebles residenciales de Venezuela con **SEO programático**: N páginas de listado
generadas por la combinación `operación × tipo × ubicación`, más una ficha por inmueble, con conversión
por **WhatsApp** (no hay carrito, no hay checkout, no hay cuentas de usuario).

"Tipo ecommerce" = la **UX** de un ecommerce (grid, filtros, ficha de producto, galería), no la
**infraestructura** de uno. Esta distinción define todo el alcance de abajo.

---

## 1. Decisión de arquitectura (la más importante)

El doc técnico especifica: `Next.js + Postgres + Prisma + API de ingesta con API key + R2/S3 + WP headless`.
Ese stack existe para resolver **un scraper que escribe en vivo, 24/7, con dedup e imágenes que caducan**.

Si la data entra por CSV → JSON, ese problema no existe en v1. Nada de eso hace falta:

| Componente del doc | ¿Necesario con CSV→JSON? | Reemplazo |
|---|---|---|
| PostgreSQL | ❌ No en v1 | `data/listings.json` versionado en el repo |
| Prisma / migraciones | ❌ No en v1 | Tipos TypeScript + validación con Zod al importar |
| `POST /api/v1/listings` + API key | ❌ No en v1 | Script `npm run import` (CSV → JSON validado) |
| Dedup por `post_id` | ⚠️ Se resuelve en el script | Clave única por fila en el CSV |
| ISR / `revalidatePath` | ❌ No en v1 | SSG puro: data nueva → re-build (minutos) |
| R2/S3 + re-hospedaje | ⚠️ Depende de dónde estén las fotos | Ver §5 (bloqueante) |
| WordPress headless (`/guías`) | ❌ Fuera de v1 | Fase 2 |

**Lo que sí se mantiene intacto del doc:** la taxonomía de URLs (§7), la estructura de headings (§8), las
reglas de presentación de la ficha (§9) y el SEO técnico (§10). Ahí está el valor del proyecto y no cambia.

**Regla:** si el volumen de inmuebles supera ~5.000 o el CSV pasa a actualizarse varias veces al día,
se migra a Postgres. Antes de eso, la base de datos es peso muerto.

---

## 2. Requerimientos funcionales

### 2.1 Plantillas de página (3 en v1)

**A. Home `/`**
- H1: "Portal inmobiliario de Venezuela: apartamentos y casas en venta y alquiler"
- Grid de ciudades piloto · destacados de venta (apartamentos y casas) · explorar por estado · CTA publicar

**B. Listado** — 3 niveles, misma plantilla
- `/[operacion]/[tipo]/[estado]` → `/venta/apartamentos/lara`
- `/[operacion]/[tipo]/[ciudad]/[estado]` → `/venta/apartamentos/barquisimeto/lara`
- `/[operacion]/[tipo]/[ciudad]/[estado]/[barrio]` → `.../del-este`
- H1 dinámico `{Tipo} en {Venta/Alquiler} en {Ubicación}` · intro templado 60–90 palabras ·
  grid de resultados · chips a barrios · chips a otros tipos · chips a la operación opuesta · FAQ (3 H3)

**C. Ficha** — `/[tipo]-[op]-[barrio]-[ciudad]/[publicId]`
- Breadcrumb · H1 · barra de datos clave · galería · descripción · tabla de características ·
  ubicación (texto, sin mapa en v1) · CTA WhatsApp · crédito de origen · similares

### 2.2 Reglas de negocio no negociables

1. **Campos obligatorios (6):** `operacion`, `tipo`, `estado`, `ciudad`, ≥1 foto, `whatsapp`.
   Todo lo demás se **auto-oculta si viene vacío** — nunca renderizar un label sin valor.
2. **Precio:** `null` → badge "Precio a consultar". Presente → `US$ 45.000` (formato es-VE).
3. **WhatsApp:** `https://wa.me/<E164 sin +>?text=Hola, me interesa este inmueble: <url>`.
4. **Título autogenerado** si falta: `{Tipo} en {operación} en {barrio||ciudad}`.
5. **`data_quality`:** `completo` si hay precio Y (habitaciones O m²); si no, `parcial`.
6. **Umbral de indexación (anti-thin-content):**
   - Listado indexable solo con **≥3 inmuebles** activos.
   - Ficha indexable solo con ≥1 foto Y (precio O descripción).
   - Debajo del umbral → `robots: noindex, follow`. La página existe y enlaza, pero no compite.
7. **Filtros = query params**, nunca URLs indexables (salvo whitelist, p. ej. `habitaciones`).
8. **Slugs sin acentos ni espacios**, una canónica por combinación.

### 2.3 Modelo de datos (JSON, no Prisma)

> **Corrección salida del piloto (§9):** un mismo aviso puede ofrecer **venta y alquiler a la vez**
> (`"Venta 290000$ / Alquiler 3000$"`). Eso son **dos fichas**, una en `/venta` y otra en `/alquiler`,
> no una ficha ambigua ni un descarte. El `publicId` se deriva por oferta:
> `<shortcode>-venta` y `<shortcode>-alquiler`. En el piloto, 3 de 24 avisos eran de este tipo.

```ts
type Listing = {
  publicId: string           // <shortcode>-<operacion>, unico por ficha
  slug: string               // derivado
  operacion: 'venta' | 'alquiler'
  tipo: 'apartamento' | 'casa' | 'quinta' | 'townhouse' | 'penthouse' | 'anexo'
  ubicacion: { estado: string; ciudad: string; barrio?: string }   // slugs normalizados
  precio: { monto: number | null; moneda: 'USD' }
  titulo?: string
  descripcion?: string
  areaM2?: number
  atributos?: {              // capa 2, todos opcionales
    habitaciones?: number; banos?: number; estacionamientos?: number
    amoblado?: boolean; estadoInmueble?: 'obra_nueva' | 'usado'
    piso?: number; mantenimientoUsd?: number
    areaTerrenoM2?: number; plantas?: number
    amenidades?: string[]
  }
  contacto: { whatsapp: string; nombre?: string }
  fotos: string[]            // ≥1
  fuente?: { plataforma: string; handle?: string; postUrl?: string }
  dataQuality: 'completo' | 'parcial'
}
```

El árbol geográfico (`estado → ciudad → barrio`) se **deriva del JSON de inmuebles** en tiempo de build,
más un `data/locations.json` semilla con las 5 ciudades y sus barrios prioritarios (§3 del doc técnico).
Un barrio que aparezca en el CSV y no esté en la semilla se crea automáticamente.

---

## 3. Fases de ejecución

### Fase 0 — Contrato de datos (bloqueante, antes de escribir una línea de UI)
- Recibir **un CSV real de muestra** (aunque sean 20 filas).
- Definir el mapeo columna CSV → campo `Listing`, incluyendo valores exactos de enums.
- Escribir el script de importación: `csv → validación → normalización → listings.json`.
- El script **rechaza y reporta** filas inválidas en lugar de generar data sucia.
- Normalizaciones: slugs (sin acentos), teléfono a E.164 `+58…`, enums, precio a entero, dedup por `publicId`.
- **Un check runnable**: fixture con 5 filas (una válida, una sin fotos, una sin precio, una con
  teléfono sucio, una duplicada) → asserts sobre la salida.

### Fase 1 — Esqueleto + Ficha
- Proyecto Next.js (App Router, TS) + Tailwind. Sin DB.
- Carga del JSON + índices en memoria (por ciudad, por barrio, por tipo/operación).
- Plantilla **Ficha** completa con las reglas de §2.2.
- Manejo de imágenes resuelto (ver §5).

### Fase 2 — Listado + motor pSEO
- Ruta catch-all que resuelve 1/2/3 segmentos de ubicación.
- `generateStaticParams()` → solo combinaciones con inventario ≥1.
- Intro templado por ubicación · chips de interlinking · FAQ.
- Filtros por query param (habitaciones, precio, m²) — client-side sobre el set ya renderizado.

### Fase 3 — Home
- Grid de ciudades, destacados, explorar por estado.

### Fase 4 — SEO técnico
- `sitemap.xml` segmentado por nivel, solo URLs indexables.
- JSON-LD: ficha → `Product`/`Offer`; listado → `ItemList` + `BreadcrumbList`; FAQ → `FAQPage`.
- Canonical + `hreflang="es-VE"` + robots por umbral.
- Core Web Vitals como criterio de aceptación (`next/image`, sin JS innecesario).

### Fase 5 — QA y lanzamiento
- Cargar el lote real, verificar el umbral de indexación, validar JSON-LD en Rich Results Test,
  medir CWV, revisar 20 fichas y 20 listados a mano.

### Fuera de v1 (explícito)
Mapas interactivos · guías/blog WordPress · cuentas de usuario · formularios de lead · panel de anunciante ·
tipos comercial/industrial/suelo · búsqueda por radio/PostGIS · Meilisearch.

---

## 4. Criterios de aceptación de v1

- [ ] Todo listado con ≥3 inmuebles es indexable; con <3 emite `noindex, follow`.
- [ ] Ninguna ficha muestra un campo vacío ni un label sin valor.
- [ ] Todo CTA de WhatsApp abre con el mensaje pre-cargado y la URL correcta.
- [ ] El sitemap no contiene ninguna URL `noindex`.
- [ ] JSON-LD válido en las 3 plantillas.
- [ ] LCP < 2.5s en móvil en ficha y listado.
- [ ] Re-importar el mismo CSV dos veces produce el mismo JSON (idempotencia).

---

## 5. Decisiones cerradas

| # | Decisión | Consecuencia |
|---|---|---|
| 1 | **Fotos = archivos entregados por el cliente.** El CSV referencia nombres de archivo. | Cero riesgo de links caducados. Las imágenes van a `public/inmuebles/`, `next/image` genera AVIF/WebP y los tamaños responsive en el build. Se elimina R2/S3 y todo el pipeline de re-hospedaje del §6.4 del doc técnico. |
| 2 | **CSV de carga inicial + cambios esporádicos.** | **SSG puro confirmado.** Sin base de datos, sin ISR, sin API de ingesta. Flujo de actualización: reemplazar el CSV → `npm run import` → `git push` → deploy automático. |
| 3 | **El sitio se genera solo desde lo que traiga el CSV.** | Cero páginas vacías por construcción. La matriz de 8.242 páginas del estudio pSEO pasa a ser el **techo teórico**, no el objetivo de v1. El árbol geográfico se deriva de la data real, no de una lista fija de 24 estados. Se descarta el seed de `locations.json`. |
| 4 | **Diseño: editorial cálido** (ver §7). | No se acepta look "plantilla genérica". Sistema de diseño definido antes de construir UI. |
| 5 | **Re-extraer los campos desde el caption** con una pasada de Claude (ver §9). | Recupera los 389 inmuebles sin operación definida, los 75 sin tipo y buena parte de los 424 sin precio. Sin esto se publica la mitad del inventario. |
| 6 | **Se incluyen los 144 no residenciales** (oficina, local, terreno, galpón). | El enum de `tipo` crece a 10 valores. Cero costo extra de desarrollo, +12% de inventario y keywords comerciales. Alinea con la Fase 1 del estudio pSEO. |

### Sigue abierto
- **Los 13 números de WhatsApp** (uno por perfil de Instagram). Ver §8.
- **Las fotos reales.** Ver §8.
- ~~Dominio y hosting~~ **Cerrado:** la marca es **Mudave** y el dominio **mudave.com** (registrado el 2026-11-06). Es el valor por defecto de `SITIO` en `src/lib/seo.ts`; `NEXT_PUBLIC_SITE_URL` lo sobreescribe. Hosting en Vercel.

---

## 6. Riesgos heredados del estudio

1. **Inventario insuficiente → thin content.** El riesgo #1. Mitigado por la regla de umbral.
2. **Explosión de facetas.** Filtros combinables generan URLs infinitas → query params + canonical.
3. **Frescura de la data.** Inmuebles vendidos que siguen publicados destruyen la confianza. Necesitamos
   una columna de estado o fecha en el CSV para poder despublicar.
4. **Imágenes caducadas.** Ver decisión abierta #1.

---

## 7. Dirección de diseño

El objetivo declarado: **no puede parecer una página genérica**. Debe tener identidad, verse de calidad
y ser inmediatamente comprensible. Tres principios que aplican sea cual sea la dirección elegida:

1. **La foto manda.** En inmobiliario la imagen es el producto. Fotos grandes, ratio consistente,
   sin bordes ni sombras que compitan. Todo lo demás es tipografía y espacio.
2. **Una sola familia tipográfica bien usada** vence a tres mal combinadas. Jerarquía por peso y tamaño,
   no por color.
3. **Densidad honesta.** El usuario busca comparar: precio, m², habitaciones, zona. Esos cuatro datos
   deben leerse en la card sin esfuerzo. Nada de cards decorativas que esconden la información.

Anti-patrones explícitamente prohibidos: gradientes morados, glassmorphism, emojis como iconos,
sombras difusas en todo, hero con imagen de stock genérica, "✨" en los títulos.

### Dirección elegida: **Minimalismo tipo Airbnb**

Se adopta la estructura real de Airbnb, no una imitación superficial: navbar con pill de búsqueda
funcional, tira de categorías con iconos de línea, y su anatomía de tarjeta. Es la UX que la gente
ya sabe usar, así que el esfuerzo de diseño no se gasta en enseñar a navegar.

**Tokens implementados** (`src/app/globals.css`, vía `@theme` de Tailwind v4):

| Token | Valor | Razón |
|---|---|---|
| Tipografía | **Figtree** vía `next/font` (self-hosted) | La libre más cercana a Airbnb Cereal: geométrica, altura de x alta. |
| Fondo | `#ffffff` · superficie `#f7f7f7` | Blanco puro, como Airbnb. |
| Texto | `#222222` · secundario `#717171` · terciario `#9c9c9c` | Escala de grises neutra de Airbnb. |
| Acento | **terracota `#d9480f`** | El equivalente al coral de Airbnb sin ser rosado. Rojo y azul ya los ocupan ReMax y TuInmueble. Vive en 4 sitios y en ninguno más: logo, botón de búsqueda, CTA de contacto y categoría activa. |
| Secundarios | **mar `#0b7285`** · **ámbar `#b8760b`** | Clasifican, no decoran: mar = alquiler y comercial, ámbar = suelo y cifras destacadas. |
| Tintes de fondo | crema `#fdf7f3` · menta `#f1f8f8` | Separan secciones por color en vez de dibujar más cajas. |
| Bordes | `2px #dddddd` · suave `#ebebeb` · radio `20px` | Definición por borde. Trazo grueso y esquinas muy redondeadas (2026-11-09): el sitio se lee más sólido sin añadir color ni sombra. |
| Sombras | Una sola en el sistema: el pill de búsqueda y la tarjeta de contacto. | Las sombras difusas por todos lados son la firma de la plantilla genérica. |
| Ratio de foto | `4:3` en el grid, `16:9` en la galería de ficha | Consistencia de ratio = grid profesional, y cero layout shift. |

**Componentes construidos**
- `src/components/icons.tsx` — 14 iconos de línea (24×24, trazo 1.6) escritos a mano, sin librería:
  búsqueda, cama, baño, área, estacionamiento, pin, chevron, check, WhatsApp + uno por tipo de inmueble.
- `src/components/Buscador.tsx` — pill de la navbar. **Navega de verdad**: compone la ruta pSEO
  (`operación → tipo → ciudad/estado`) y empuja. Selects nativos: accesibles, con teclado, cero JS de librería.
- `src/components/TipoStrip.tsx` — tira de categorías. Además de navegación es interlinking real
  hacia cada combinación tipo × ubicación, y solo muestra los tipos que existen en esa ubicación.
- `src/components/ui.tsx` — tarjeta con la anatomía de Airbnb: foto redondeada sin borde → barrio en
  negrita → ciudad → `hab · baños · m²` → precio abajo. Sin badges ni corazones decorativos.

**Anti-patrones evitados:** gradientes, glassmorphism, emojis como iconos, sombras en todo,
corazones de favorito que no guardan nada.

---

## 8. Diagnóstico de la data real (`PSEO Venezuela.xlsx`)

Convertido con `scripts/xlsx_to_data.py` → `data/raw/*.csv` + `*.json`. **Cero celdas perdidas**
(verificado celda por celda contra el origen, incluidos los 2.383 hipervínculos).

### Qué hay

| Hoja | Filas | Contenido |
|---|---|---|
| `Inmuebles` | **1.146** reales (+3 fantasma) | El inventario. 13 columnas + 3 de hipervínculos rescatados. |
| `Todos_los_posts` | 2.948 | Todos los posts scrapeados, con `Shortcode` y **1 ruta de imagen local**. |
| `Videos_Encontrados` | 901 | Carpetas de Drive con material extra. Cruzan con 421 inmuebles. |
| `Resumen` | 8 | Conteos por ciudad. |

Distribución: Caracas 377 · Barquisimeto 300 · Maracaibo 219 · Maracay 154 · Valencia 96.
13 perfiles de Instagram (mayoría RE/MAX y RAH). 1.136 de 1.146 inmuebles cruzan con su post por
shortcode; 10 quedan huérfanos.

### El hallazgo que evita perder data

La columna **`Carpeta en Drive` muestra `📁 Ver carpeta` en las 1.146 filas** — el dato real, una URL
de Drive **única por inmueble**, vive únicamente en el hipervínculo. Un "Guardar como CSV" desde Excel
o un `pandas.read_excel` borra esas 1.146 URLs y con ellas el acceso a las fotos. El conversor las
rescata como columnas `Carpeta en Drive URL`, `URL del Post URL`, `Perfil IG URL`.

### Qué falta o está sucio

| Problema | Magnitud | Salida |
|---|---|---|
| **No existe columna `operación`** (obligatorio) | 100% | Del caption se infiere: 628 venta, 129 alquiler, pero **389 (34%) quedan ambiguos o sin señal**. |
| **No existe columna `whatsapp`** (obligatorio) | 100% | Solo 27% de los captions traen teléfono. **13 perfiles IG → 13 números** cubre el 100%. |
| Sin precio | 424 (36%) | Van a "Precio a consultar", pero sin precio ni descripción la ficha queda `noindex`. |
| `Ubicación` es texto libre | 622 valores únicos | Mezcla `"Altos de Bucare, Cabudare"` con `"Maracay"` a secas. 46 no traen barrio. Hay que parsear a `barrio` + `ciudad`. |
| Sin tipo | 75 | El parser del scraper no lo detectó; el caption casi siempre sí lo dice. |
| `M2` corrupto | 34 no numéricos + **103 menores a 20 m²** | Valores como `2.0` o `3.0`: el parser confundió habitaciones con metros. |
| Outliers | `Habitaciones: 39`, `Baños: 28` | Errores de parseo del caption. |
| Tipos fuera del alcance residencial | 144 (Oficina 65, Local 57, Terreno 17, Galpón 5) | Decisión de alcance. |
| Filas fantasma | 3 | Solo traen una URL duplicada. Se descartan en el import (no en la capa raw). |

### La conclusión importante

**El Excel es un parseo débil de los captions, y los captions sí traen la información.** Los 1.146
captions completos están íntegros en la data — ahí están el precio, la operación, el tipo, los m²,
las habitaciones, las amenidades y el barrio, escritos en lenguaje natural. Re-extraer los campos
desde el caption con una pasada estructurada (§9) recupera la mayoría de los huecos de arriba.
Sin eso, lanzamos con 36% de fichas sin precio y sin poder separar venta de alquiler — que es
precisamente la primera bifurcación de toda la arquitectura de URLs.

### Estado de las fotos — BLOQUEANTE

- La hoja `Todos_los_posts` trae **una sola ruta local por post** (`fotos/<perfil>/<perfil>_<shortcode>.jpg`),
  pero `Cant. Fotos` llega hasta 20 por inmueble.
- **La carpeta `fotos/` no está en esta máquina.**
- **Drive no es viable tal como está compartido.** Probado: los metadatos de una carpeta se leen bien por ID
  (dueño: `juliandavidsegurovela@gmail.com`), pero **listar su contenido devuelve vacío**. No es error de
  sintaxis — la misma consulta sobre el Drive propio funciona. Las carpetas están compartidas por enlace,
  no indexadas para la cuenta, así que no se pueden obtener los IDs de las fotos ni descargarlas.
- **Salidas, de más rápida a más lenta:**
  1. Pedir a Julián el directorio `fotos/` que ya generó el scraper (es local, existe). Vía más corta.
  2. Que comparta la **carpeta raíz** que contiene las 1.146 subcarpetas directamente con
     `fabian@upstreamagency.io` (no por enlace). Con eso el listado se desbloquea.
  3. Descarga con `rclone` + cuenta de servicio, usando los 1.146 IDs de carpeta que ya tenemos rescatados.
- Sin fotos no hay ficha publicable: es el obligatorio #5 y es el producto.

---

## 9. Plan de re-extracción desde los captions

**Por qué:** el Excel es un parseo por reglas de los captions y falla en lo esencial (34% sin operación,
36% sin precio, 103 valores de m² corruptos). Los captions íntegros sí tienen los datos.

**Cómo, sin dependencias nuevas:** no hay `ANTHROPIC_API_KEY` ni SDK en la máquina, pero el binario de
Claude Code sí está instalado. La pasada corre en **modo headless (`claude -p`) con el plan actual**:
sin API key, sin instalar nada, sin costo adicional.

- Entrada: los 1.146 captions de `data/raw/Inmuebles.json`, en lotes.
- Salida: un JSON por inmueble con `operacion`, `tipo`, `precio`, `m2`, `habitaciones`, `banos`,
  `estacionamientos`, `barrio`, `amenidades[]`, `telefono`, `amoblado`.
- **Regla de conflicto:** si el Excel y el caption discrepan, gana el caption, pero se conserva el valor
  original del Excel en el registro. Nada se sobrescribe en silencio.
- **Regla de abstención:** el modelo devuelve `null` cuando el caption no lo dice. Prohibido inventar
  un precio o una operación. Un `null` es un "Precio a consultar" honesto; un dato inventado es una
  mentira publicada.
- Se corre **una sola vez** y el resultado queda versionado en el repo. No es una dependencia de runtime.
- **Check runnable:** un set de 20 captions con el resultado esperado escrito a mano; si la extracción
  se desvía, falla.

### Resultado del piloto (24 avisos)

La extracción **le gana al Excel en los casos difíciles**, verificado contra el caption original:

| Caso | Excel | Extracción | Quién acierta |
|---|---|---|---|
| `1.129,97 m2` | `129,97` (se comió el 1) | `1129.97` | Extracción |
| `1000 M2 Terreno / 480M2 Construcción` | `M2 = 1000` | `m2=480`, `area_terreno=1000` | Extracción |
| `Venta 290000$ / Alquiler 3000$` | precio 290000, sin operación | 2 ofertas → 2 fichas | Extracción |

- Operación recuperada: **23/24** (el Excel no tiene la columna: 0/24).
- **26 fichas publicables de 24 avisos**, las 26 con precio (el Excel: 22 con precio).
- Barrio limpio y separado de la ciudad: 21/24.
- Teléfono en el caption: **0/24** → confirma que el mapa de 13 números es imprescindible.

**Rendimiento:** ~1,8 min por lote de 12. Con 8 procesos en paralelo, los 1.146 tardan ~30 min.
Reanudable: si falla a mitad, se relanza el mismo comando y sigue donde quedó.

---

## 10. Mapa con dibujo de zona (Home)

Mapa de Venezuela en el Home con filtro por zona dibujada a mano, al estilo Airbnb.

### El problema de fondo: no había coordenadas

La data trae `"Las Mercedes, Caracas"` como texto libre. Un mapa necesita lat/lng, así que
`scripts/geocode.py` geocodifica ciudades y barrios contra **Nominatim (OpenStreetMap)** —
gratis, sin API key, respetando su límite de 1 req/s. Reanudable: relanzarlo solo pide lo que falta.

**Dos defensas, porque geocodificar a ciegas pone pines donde no van:**
1. Se rechazan las clases de POI (`shop`, `amenity`, `tourism`…). Sin esto, *La Lago* resuelve
   a un supermercado de Maracaibo que se llama igual — verificado en la primera prueba.
2. El resultado debe caer a **menos de 25 km del centro de su ciudad**. Es la defensa fuerte:
   descarta homónimos de otros estados.

### La decisión de honestidad

Muchas urbanizaciones venezolanas **no existen en OpenStreetMap**. Un barrio no ubicable podría
heredar el centro de su ciudad, pero entonces dibujar una zona pequeña devolvería inmuebles que
no están ahí: **la función mentiría**. Por eso el mapa solo incluye inmuebles cuyo barrio se ubicó
de verdad, y la UI declara la cobertura. Mostrar menos es preferible a mostrar mal.

Dentro de un barrio sí conocemos el centroide pero no la dirección, así que los inmuebles se
dispersan con un desplazamiento **determinista** (derivado del `publicId`) dentro de ~350 m —
sin eso se apilan en un solo pin. La UI avisa: *"Ubicación aproximada a nivel de urbanización"*.

### Implementación

| Pieza | Decisión |
|---|---|
| Librería | **MapLibre GL** (open source, sin API key). Ojo: la v6 eliminó el `export default`, hay que usar imports nombrados. |
| Tiles | **Actualización:** CARTO pasó a devolver "API KEY REQUIRED" en todos los tiles. Ahora se usa **Positron de OpenFreeMap** (vectorial, sin API key, uso comercial libre); funciona porque el worker ya está arreglado (ver abajo). El resto de esta fila es historia. — **Positron de CARTO en raster**, con un estilo mínimo escrito en el propio componente. El estilo *vectorial* de CARTO encadena TileJSON + sprite + glyphs + 93 capas y **nunca completaba**: `isStyleLoaded()` se quedaba en `false` para siempre y el mapa salía en blanco, sin errores en consola. Raster son imágenes: una petición por tile y nada más que resolver. Requiere mantener la atribución. |
| Montaje de capas | En cuanto el estilo está listo (`styledata`/`sourcedata`/`load`/`idle`, con guarda), **no** en `load`. Ese evento espera al primer render completo y puede tardar o no llegar, dejando el mapa base pintado sin un solo inmueble encima. |
| Agrupación | `cluster: true` **nativo** de la fuente GeoJSON. Cero código y cero plugins para agrupar 1.000+ puntos. |
| Dibujo | Eventos `pointer*` sobre el contenedor → puntos de pantalla → `unproject()` a lat/lng. SVG encima para el trazo en vivo. |
| Punto en polígono | **Número de vueltas (regla nonzero), 12 líneas.** Se evita turf.js (~80 KB) para una sola función. No es par-impar porque un círculo dibujado a mano casi siempre se cruza consigo mismo al cerrarse, y ese solape no debe quedar "fuera". |
| Zonas | Varias zonas que se **suman**. Se guardan en lat/lng y se pintan como capa del mapa, así siguen en su sitio al mover o acercar. `cerrarTrazo()` recorta la cola cuando el trazo se pasa del inicio. |
| Gestos | `cooperativeGestures`: la rueda y un dedo bajan la página; el zoom pide Ctrl/⌘ o dos dedos. El mapa llena casi toda la primera pantalla y sin esto atrapaba el scroll. Se desactiva solo mientras se dibuja. |
| Carga | **Diferida hasta el clic.** MapLibre son ~250 KB y el Home es la página más importante para SEO: hasta que el usuario lo pide, es HTML estático y el LCP no se entera. |

### El bug que costó encontrar: el web worker de MapLibre

**Síntoma:** el mapa base se veía, pero no aparecía ni un solo inmueble encima. Cero errores
en consola.

**Causa:** MapLibre 6 arranca su worker con un `Blob` que hace
`import` de una URL resuelta contra `import.meta.url`. Dentro del bundle de Turbopack esa URL
no apunta a nada, el worker muere en silencio, y **sin worker ninguna fuente GeoJSON llega a
teselarse**. Los tiles raster sí se ven porque no pasan por el worker — de ahí que pareciera
que "el mapa funciona pero faltan los pines".

**Solución:** servir el worker desde `public/` y apuntarlo con `setWorkerUrl()`.
`scripts/copy-map-worker.mjs` lo copia en cada build (`prebuild`) para que no se desfase al
actualizar la librería. El worker importa su módulo compartido de forma relativa, así que los
dos ficheros viajan juntos.

**Lección de método:** el diagnóstico headless fue engañoso. `isSourceLoaded()` y
`queryRenderedFeatures()` dependen del bucle de render, que no corre sin GPU, así que daban
"falso" tanto con el bug como sin él. La verdad solo apareció al leer la consola de un Chrome
real por CDP (`scratchpad/cdp.mjs`): `srcLoaded: true`, `pintados: 3`.

### Pendiente
- Subir la cobertura geocodificada (hoy la limita OSM). Alternativas: geocodificador de pago,
  o cargar los barrios prioritarios a mano.
- Llevar el mapa también a las páginas de listado, con vista partida lista + mapa.

---

## 11. Cimientos: paginación, facetas y previsualización social

### El problema que no se veía

Una página de listado servía **513.891 bytes de HTML** porque pintaba sus 146 fichas de una vez.
Incumplía el criterio de §4 (*LCP < 2,5 s*) y era el mayor riesgo de rendimiento del sitio.
Y no había Open Graph: cada enlace compartido por WhatsApp —el único canal de conversión—
llegaba sin imagen, sin título y sin precio.

### Paginación

`/…/pagina/2`, ruta y no query param: indexable y sin chocar con el `Disallow: /*?` de robots.
24 por página. **Resultado: 514 KB → 157 KB.**

- La página 1 nunca lleva sufijo; `/pagina/1` devuelve 404 porque duplicaría la URL base.
- Páginas 2+ con canonical a sí mismas e indexables, pero **fuera del sitemap**: se descubren
  por enlaces. El sitemap sigue listando solo URLs canónicas de alta intención.
- El `title` de las páginas 2+ lleva su número, para que no compitan con la 1.
- **Las cifras, la intro y el FAQ se calculan sobre `todos`, no sobre el tramo visible:**
  describen la combinación entera, no la página.

### Faceta de habitaciones

`/venta/apartamentos/caracas/distrito-capital/3-habitaciones` — la **única faceta indexable**,
porque es la única con demanda real de búsqueda. El resto de filtros irán por query param.

> **Corrección (2026-11-06):** robots ya no lleva `Disallow: /*?`. Esa regla bloqueaba todas
> las fotos (`/_next/image?url=…`), la tarjeta OG (`/api/og?id=…`) y el favicon, sin ningún
> aviso. Ahora solo se bloquea `/buscar?`. Cada filtro nuevo por query param debe bloquear
> su propio patrón en `src/app/robots.ts`.

142 facetas superan el umbral; 87 entran al sitemap (las 55 de nivel estado canonicalizan a su
ciudad por la misma regla de §10). Solo se ofrecen en la UI las que superan el umbral: enviar al
usuario a una página que nacería en `noindex` es enviarlo a un callejón.

**Parseo desde el final** en `parseListado()`: primero la paginación, luego la faceta. Así
`/venta/apartamentos/lara/pagina/2` (5 segmentos) no se confunde con
`/venta/apartamentos/barquisimeto/lara/del-este`, que también son 5.

### Open Graph

`/api/og` genera la tarjeta **bajo demanda**, no en el build: precomputar ~2.000 imágenes
alargaría cada build para algo que el CDN cachea igual tras la primera petición.
Como el inventario aún no tiene fotos, **esa tarjeta ES la imagen del inmueble**: precio grande,
ubicación y datos clave.

El contenido se **deriva** de la data a partir del `id` o de la ruta; nunca se pinta texto libre
que venga en la query.

> `OG_BASE` hay que repetirlo en cada `generateMetadata` que defina `openGraph`: Next fusiona los
> metadatos de forma **superficial**, así que el objeto de la página sustituye al del layout en
> vez de completarlo. Sin eso se perdían `og:type`, `og:locale` y `og:site_name`.

### 404 propia y JSON-LD de sitio

La 404 de Next sale en inglés y con fondo oscuro, y deja al usuario sin salida. La nuestra ofrece
las 5 ciudades con sus conteos y los tipos principales.

`Organization` + `WebSite` en el layout. **Sin `SearchAction`**: necesita una URL de búsqueda por
texto que aún no existe, y declararla apuntando a nada sería una señal falsa.

### Sitemap resultante

| Tipo | URLs |
|---|---|
| Home | 1 |
| Listados canónicos | 103 |
| Facetas de habitaciones | 87 |
| Fichas | 1.016 |
| **Total** | **1.207** |
