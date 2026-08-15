import type { Tipo } from "@/lib/types";

/**
 * Iconos de línea, 24×24, trazo 1.6. Heredan color y tamaño del contexto.
 * Escritos a mano en vez de instalar una librería: son 14 y no cambian nunca.
 */
type P = { className?: string; size?: number };

const Svg = ({ children, className = "", size = 24 }: P & { children: React.ReactNode }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true" focusable="false"
  >
    {children}
  </svg>
);

export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Svg>
);

export const IconBed = (p: P) => (
  <Svg {...p}>
    <path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M4 18v2M20 18v2" />
    <path d="M7 11V8.5A1.5 1.5 0 0 1 8.5 7h7A1.5 1.5 0 0 1 17 8.5V11" />
  </Svg>
);

export const IconBath = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Z" />
    <path d="M7 12V6.5A2.5 2.5 0 0 1 12 6M7 20l-1.2 2M17 20l1.2 2" />
  </Svg>
);

export const IconArea = (p: P) => (
  <Svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>
);

export const IconCar = (p: P) => (
  <Svg {...p}>
    <path d="M4 13.5 5.6 8.9A2 2 0 0 1 7.5 7.5h9a2 2 0 0 1 1.9 1.4L20 13.5" />
    <path d="M3.5 13.5h17v4h-17zM6 17.5v2M18 17.5v2M7 15.5h.01M17 15.5h.01" />
  </Svg>
);

export const IconPin = (p: P) => (
  <Svg {...p}><path d="M20 10.5c0 5.8-8 11.5-8 11.5S4 16.3 4 10.5a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10.2" r="2.8" /></Svg>
);

export const IconChevron = (p: P) => (<Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>);

export const IconCheck = (p: P) => (<Svg {...p}><path d="m4 12.5 5 5L20 6.5" /></Svg>);

/** Marca de WhatsApp: relleno, no trazo. */
export const IconWhatsapp = ({ className = "", size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.42 1.31-1.96 1.36-.5.05-.98.23-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.12-.14-.18-1.12-1.49-1.12-2.84 0-1.35.71-2.02.96-2.29.25-.28.55-.35.73-.35h.52c.17 0 .4-.06.62.48.24.57.8 1.98.87 2.12.07.14.12.31.02.5-.1.18-.15.29-.29.45-.14.16-.3.36-.43.48-.14.14-.29.29-.13.57.17.28.74 1.22 1.58 1.97 1.09.97 2 1.27 2.29 1.41.28.14.45.12.62-.07.17-.2.71-.83.9-1.11.19-.28.38-.23.64-.14.26.09 1.67.79 1.95.93.29.14.48.21.55.33.07.11.07.66-.17 1.34Z" />
  </svg>
);

/* Un icono por tipo de inmueble: son las categorías de la tira superior. */

const Apartamento = (p: P) => (
  <Svg {...p}><path d="M4 21V4.5A1.5 1.5 0 0 1 5.5 3h7A1.5 1.5 0 0 1 14 4.5V21M14 21V10h4.5A1.5 1.5 0 0 1 20 11.5V21M3 21h18M7 7h3M7 11h3M7 15h3M16.5 14h1M16.5 17.5h1" /></Svg>
);
const Casa = (p: P) => (
  <Svg {...p}><path d="m3 10.5 9-7 9 7M5.5 9v12h13V9M10 21v-6h4v6" /></Svg>
);
const Quinta = (p: P) => (
  <Svg {...p}><path d="M3 21h18M4.5 21V11l7.5-5 7.5 5v10M9.5 21v-5h5v5M8 12.5h1.5M14.5 12.5H16" /></Svg>
);
const Townhouse = (p: P) => (
  <Svg {...p}><path d="m2 10.5 5-4 5 4M12 10.5l5-4 5 4M4 21V10M12 21V10M20 21V10M2 21h20M6.5 21v-4.5h3V21M14.5 21v-4.5h3V21" /></Svg>
);
const Penthouse = (p: P) => (
  <Svg {...p}><path d="M5 21V8l7-5 7 5v13M3 21h18M8.5 12h2M13.5 12h2M9.5 21v-5h5v5M5 8h14" /></Svg>
);
const Anexo = (p: P) => (
  <Svg {...p}><path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M4 21h16M14 12.5h.01" /></Svg>
);
const Oficina = (p: P) => (
  <Svg {...p}><path d="M3 8.5h18V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5ZM8.5 8.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.5M3 13.5h18" /></Svg>
);
const Local = (p: P) => (
  <Svg {...p}><path d="M3.5 9.5h17V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9.5ZM3.5 9.5 5.5 4h13l2 5.5M9.5 21v-6h5v6" /></Svg>
);
const Terreno = (p: P) => (
  <Svg {...p}><path d="m9 4-5.5 2.2v13.6L9 17.6l6 2.2 5.5-2.2V4L15 6.2 9 4ZM9 4v13.6M15 6.2V19.8" /></Svg>
);
const Galpon = (p: P) => (
  <Svg {...p}><path d="m2.5 10 9.5-5 9.5 5v11h-19V10ZM6.5 21v-8h11v8M6.5 17h11" /></Svg>
);

export const ICONO_TIPO: Record<Tipo, (p: P) => React.JSX.Element> = {
  apartamento: Apartamento, casa: Casa, quinta: Quinta, townhouse: Townhouse,
  penthouse: Penthouse, anexo: Anexo, oficina: Oficina, local: Local,
  terreno: Terreno, galpon: Galpon,
};
