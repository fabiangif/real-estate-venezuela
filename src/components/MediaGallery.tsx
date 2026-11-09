"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { TIPO_LABEL, type Listing } from "@/lib/types";

type MediaItem = { type: "image" | "video"; src: string; photoNumber?: number };

function IconPlay({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-current">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-current">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}

function IconVolume({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-2">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {muted ? <path d="m17 9 4 6m0-6-4 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7" />}
    </svg>
  );
}

function IconExpand() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-2">
      <path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" />
    </svg>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function VideoPlayer({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const enterFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) await video.requestFullscreen();
    else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="group/video relative aspect-[4/3] overflow-hidden rounded-card bg-black">
      <video
        ref={videoRef}
        src={src}
        aria-label={`Video de ${title}`}
        className="size-full object-contain"
        playsInline
        muted={muted}
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reproducir video"
          className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-tinta shadow-[0_6px_24px_rgba(0,0,0,.28)] transition-transform hover:scale-105"
        >
          <span className="translate-x-0.5"><IconPlay paused /></span>
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-10 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover/video:opacity-100 sm:group-focus-within/video:opacity-100">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (videoRef.current) videoRef.current.currentTime = next;
            setCurrentTime(next);
          }}
          aria-label="Progreso del video"
          className="media-progress w-full"
          style={{ background: `linear-gradient(to right, #fff ${progress}%, rgba(255,255,255,.38) ${progress}%)` }}
        />
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pausar video" : "Reproducir video"}
            className="grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15">
            <IconPlay paused={!playing} />
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar video"}
            className="grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15">
            <IconVolume muted={muted} />
          </button>
          <span className="tabular text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <button type="button" onClick={enterFullscreen} aria-label="Ver video en pantalla completa"
            className="ml-auto grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15">
            <IconExpand />
          </button>
        </div>
      </div>
    </div>
  );
}

function Media({ item, listing, index, desktop = false }: {
  item: MediaItem;
  listing: Listing;
  index: number;
  desktop?: boolean;
}) {
  if (item.type === "video") return <VideoPlayer src={item.src} title={listing.titulo} />;
  return (
    <div className={`relative ${desktop && index === 0 ? "aspect-[16/9]" : "aspect-[4/3]"} overflow-hidden rounded-card bg-humo`}>
      <Image
        src={item.src}
        alt={`${listing.titulo}, foto ${item.photoNumber}`}
        fill
        preload={desktop && index === 0}
        sizes={desktop
          ? index === 0 ? "(max-width:1024px) 100vw, 60vw" : "(max-width:1024px) 50vw, 30vw"
          : "100vw"}
        className="object-cover"
      />
    </div>
  );
}

export default function MediaGallery({ listing }: { listing: Listing }) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const media: MediaItem[] = [
    ...listing.fotos.map((src, index) => ({ type: "image" as const, src, photoNumber: index + 1 })),
    ...listing.videos.map((src) => ({ type: "video" as const, src })),
  ];

  if (!media.length) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-card bg-humo text-sm text-tinta-3">
        {TIPO_LABEL[listing.tipo].singular}
      </div>
    );
  }

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(media.length - 1, index));
    galleryRef.current?.querySelectorAll("video").forEach((video) => video.pause());
    galleryRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActive(next);
  };

  return (
    <>
      <div className="relative sm:hidden" aria-label="Galería multimedia">
        <div
          ref={galleryRef}
          onScroll={(event) => {
            const width = event.currentTarget.clientWidth;
            if (width) setActive(Math.round(event.currentTarget.scrollLeft / width));
          }}
          className="sin-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card"
        >
          {media.map((item, index) => (
            <div key={item.src} className="min-w-full snap-center">
              <Media item={item} listing={listing} index={index} />
            </div>
          ))}
        </div>

        {media.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0}
              aria-label="Ver medio anterior"
              className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl shadow-[var(--shadow-pill)] transition-opacity disabled:opacity-0">
              ‹
            </button>
            <button type="button" onClick={() => goTo(active + 1)} disabled={active === media.length - 1}
              aria-label="Ver medio siguiente"
              className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl shadow-[var(--shadow-pill)] transition-opacity disabled:opacity-0">
              ›
            </button>
          </>
        )}

        <span className="tabular absolute bottom-3 right-3 rounded-full bg-tinta/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          {active + 1} / {media.length}
        </span>
      </div>

      <div className="hidden gap-3 sm:grid sm:grid-cols-2" aria-label="Galería multimedia">
        {media.map((item, index) => (
          <div key={item.src} className={index === 0 ? "sm:col-span-2" : undefined}>
            <Media item={item} listing={listing} index={index} desktop />
          </div>
        ))}
      </div>
    </>
  );
}
