import Image from "next/image";
import type { ReactNode } from "react";
import type { LocationImage } from "@/lib/location-images";

export function PhotoCredit({ image, inverse = false }: { image: LocationImage; inverse?: boolean }) {
  return (
    <span className={inverse ? "text-white/85" : "text-tinta-3"}>
      Foto: {" "}
      <a href={image.source} target="_blank" rel="noreferrer" className="underline hover:text-current">
        {image.credit}
      </a>{" "}
      · {" "}
      <a href={image.licenseUrl} target="_blank" rel="noreferrer" className="underline hover:text-current">
        {image.license}
      </a>
    </span>
  );
}

export function PhotoCredits({ images }: { images: LocationImage[] }) {
  return (
    <p className="mt-2 text-[10px] leading-relaxed text-tinta-3">
      Fotografías: {images.map((image, index) => (
        <span key={image.city}>
          {index > 0 && ", "}
          <a href={image.source} target="_blank" rel="noreferrer" className="underline hover:text-tinta">
            {image.credit}
          </a>{" "}
          (<a href={image.licenseUrl} target="_blank" rel="noreferrer" className="underline hover:text-tinta">
            {image.license}
          </a>)
        </span>
      ))}.
    </p>
  );
}

export function LocationHero({ image, children }: { image: LocationImage; children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-tinta">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="100vw"
        preload
        style={{ objectPosition: image.objectPosition }}
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/15" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

      <div className="relative mx-auto max-w-7xl px-5 py-10 sm:py-14">
        {children}
      </div>

      <p className="absolute bottom-2 right-5 rounded bg-black/40 px-2 py-1 text-[10px] leading-none">
        <PhotoCredit image={image} inverse />
      </p>
    </section>
  );
}
