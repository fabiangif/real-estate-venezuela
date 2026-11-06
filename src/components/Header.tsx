"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Buscador, type OpcionCiudad } from "./Buscador";
import { Logo } from "./Logo";
import { MARCA } from "@/lib/seo";
import type { Tipo } from "@/lib/types";

/**
 * Navbar fija que se encoge al bajar, como la de Airbnb: el buscador pierde sus
 * etiquetas y la barra gana sombra, devolviendo altura de pantalla al contenido.
 *
 * El scroll se lee dentro de un requestAnimationFrame para no forzar layout en cada
 * evento; React descarta el re-render cuando el booleano no cambia, asi que en la
 * practica solo hay dos renders en todo el recorrido.
 * Las transiciones se anulan solas con prefers-reduced-motion (ver globals.css).
 */
export function Header({ ciudades, tipos }: { ciudades: OpcionCiudad[]; tipos: Tipo[] }) {
  const [compacto, setCompacto] = useState(false);

  useEffect(() => {
    let raf = 0;
    const alScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCompacto(window.scrollY > 64));
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", alScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      data-compacto={compacto || undefined}
      className={`sticky top-0 z-40 border-b bg-lienzo transition-[box-shadow,border-color] duration-200 ${
        compacto ? "border-transparent shadow-[0_1px_12px_rgba(0,0,0,.08)]" : "border-borde-suave"
      }`}
    >
      <div
        className={`mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-4 px-5 transition-[padding] duration-200 lg:grid-cols-[1fr_auto_1fr] lg:gap-6 ${
          compacto ? "py-2 lg:py-2.5" : "py-3 lg:py-4"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${MARCA}, inicio`}>
          <Logo className={`origin-left text-[1.75rem] transition-transform duration-200 ${compacto ? "scale-90" : ""}`} />
        </Link>

        <div
          className={`order-3 col-span-2 w-full transition-[max-width] duration-200 lg:order-none lg:col-span-1 lg:justify-self-center ${
            compacto ? "lg:max-w-[27rem]" : "lg:max-w-[32rem]"
          }`}
        >
          <Buscador ciudades={ciudades} tipos={tipos} compacto={compacto} />
        </div>

        <div className="justify-self-end">
          <Link href="/#publicar"
            className="hidden rounded-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-humo sm:block">
            Publica tu inmueble
          </Link>
        </div>
      </div>
    </header>
  );
}
