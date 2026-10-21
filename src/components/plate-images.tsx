"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { PlateImage } from "@/lib/supabase/plate-images";

export function PlateImages({ images, label = "Plate", compact = false }: { images: PlateImage[]; label?: string; compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  if (images.length === 0) return null;
  const visibleIndex = Math.min(activeIndex, images.length - 1);
  const activeImage = images[visibleIndex];
  const shown = compact ? images.slice(0, 4) : images;
  function openImage(index: number) {
    setActiveIndex(index);
    dialog.current?.showModal();
  }
  return <>
    <div className={compact ? "@container mt-2 max-w-sm" : "mt-3 sm:mt-4"}><div className={compact ? (shown.length === 1 ? "grid max-w-xs grid-cols-1 gap-1" : shown.length === 3 ? "grid grid-cols-3 gap-1" : shown.length === 4 ? "grid grid-cols-2 gap-1 @[22rem]:grid-cols-4" : "grid grid-cols-2 gap-1") : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"}>
      {shown.map((image, index) => <button key={image.assetId} type="button"
        onClick={() => openImage(index)} aria-label={`View ${label} photo ${index + 1}${compact && index === 3 && images.length > 4 ? ` and ${images.length-4} more` : ""}`}
        className="relative cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <Image src={image.url} alt={`${label} photo ${index + 1}`} width={image.width}
          height={image.height} unoptimized className={compact && shown.length === 1 ? "aspect-[4/3] w-full rounded-md object-cover" : "aspect-square w-full rounded-md object-cover"} />
        {compact && index === 3 && images.length > 4 && <span className="absolute inset-0 grid place-items-center rounded-md bg-foreground/70 text-sm font-bold text-white">+{images.length-4}</span>}
      </button>)}
    </div></div>
    <dialog data-surface="dark" ref={dialog} aria-label={`${label} photo viewer`}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") setActiveIndex((index) => (index + 1) % images.length);
        if (event.key === "ArrowLeft") setActiveIndex((index) => (index - 1 + images.length) % images.length);
      }}
      className="m-auto w-[min(96vw,80rem)] max-w-none rounded-2xl bg-foreground p-3 text-white shadow-2xl backdrop:bg-black/80 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm">Photo {visibleIndex + 1} of {images.length}</p>
        <button type="button" onClick={() => dialog.current?.close()}
          className="rounded-lg border border-white/60 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Close viewer</button>
      </div>
      <Image src={activeImage.url} alt={`${label} photo ${activeIndex + 1}`} width={activeImage.width}
        height={activeImage.height} unoptimized className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" />
      {images.length > 1 && <div className="mt-3 flex justify-between gap-3">
        <button type="button" onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}
          className="rounded-lg border border-white/60 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Previous</button>
        <button type="button" onClick={() => setActiveIndex((index) => (index + 1) % images.length)}
          className="rounded-lg border border-white/60 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Next</button>
      </div>}
    </dialog>
  </>;
}
