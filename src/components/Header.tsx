"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Buscador } from "./Buscador";
import { Logo } from "./Logo";
import { MARCA } from "@/lib/seo";

/**
 * Navbar fija que se encoge al bajar: el buscador reduce su altura y la barra gana
 * sombra, devolviendo espacio de pantalla al contenido.
 *
 * El scroll se lee dentro de un requestAnimationFrame para no forzar layout en cada
 * evento; React descarta el re-render cuando el booleano no cambia, asi que en la
 * practica solo hay dos renders en todo el recorrido.
 * Las transiciones se anulan solas con prefers-reduced-motion (ver globals.css).
 */
export function Header({ sugerencias }: { sugerencias: string[] }) {
  const [compacto, setCompacto] = useState(false);

  useEffect(() => {
    let raf = 0;
    const alScroll = () => {
      cancelAnimationFrame(raf);
      // Histeresis: se encoge pasados 80 px y solo se expande por debajo de 24. Con un
      // unico umbral, al encogerse (~20 px menos de alto) el navegador reajusta el scroll
      // para anclar el contenido, cruza el umbral de vuelta y la barra tiembla en bucle.
      raf = requestAnimationFrame(() => setCompacto((c) => (c ? window.scrollY > 24 : window.scrollY > 80)));
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
        className={`mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-4 px-5 transition-[padding] duration-200 lg:grid-cols-[1fr_minmax(0,32rem)_1fr] lg:gap-6 ${
          compacto ? "py-2 lg:py-2.5" : "py-3 lg:py-4"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${MARCA}, inicio`}>
          <Logo className={`origin-left text-[1.75rem] transition-transform duration-200 ${compacto ? "scale-90" : ""}`} />
        </Link>

        <div
          className={`order-3 col-span-2 w-full transition-[max-width] duration-200 lg:order-none lg:col-span-1 lg:mx-auto ${
            compacto ? "lg:max-w-[27rem]" : "lg:max-w-[32rem]"
          }`}
        >
          <Buscador sugerencias={sugerencias} compacto={compacto} />
        </div>

        <div aria-hidden="true" className="hidden lg:block" />
      </div>
    </header>
  );
}
