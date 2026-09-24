"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { galleryItems as defaultGalleryItems, type GalleryItem } from "@/lib/data/gallery";

const categories: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "kitchen", label: "Kitchen" },
  { key: "bathroom", label: "Bathroom" },
  { key: "living", label: "Living Spaces" },
  { key: "hallway", label: "Hallway" },
  { key: "laundry", label: "Laundry" },
  { key: "team", label: "Behind the scenes" },
];

// Cycled per tile (not tied to real image dimensions) to give the grid a
// varied, editorial "portfolio" rhythm instead of uniform squares — object-cover
// on the fill image means nothing crops oddly regardless of the source aspect.
const aspectCycle = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[4/3]"];

export default function GalleryGrid({ items = defaultGalleryItems }: { items?: GalleryItem[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((g) => g.category === filter)),
    [filter, items]
  );

  useEffect(() => {
    if (activeIndex !== null) closeButtonRef.current?.focus();
  }, [activeIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeIndex === null) return;
      if (e.key === "Escape") setActiveIndex(null);
      if (e.key === "ArrowRight") setActiveIndex((i) => (i === null ? null : (i + 1) % filtered.length));
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, filtered.length]);

  const active = activeIndex !== null ? filtered[activeIndex] : null;

  return (
    <div>
      <div className="ios-segment" role="group" aria-label="Filter gallery by room">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className="ios-segment-item"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`group relative mb-4 block w-full overflow-hidden rounded-2xl text-left break-inside-avoid ${aspectCycle[i % aspectCycle.length]}`}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(min-width: 1024px) 22vw, 45vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              quality={90}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-navy-950/0 transition-colors duration-300 group-hover:bg-navy-950/20" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent p-3.5 pt-8">
              <span className="block text-xs font-semibold uppercase tracking-wide text-teal-300">{item.serviceType}</span>
              <span className="mt-0.5 block text-sm font-medium text-white">{item.caption}</span>
            </span>
            <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/0 text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/20 group-hover:opacity-100">
              <Expand className="size-4" aria-hidden />
            </span>
          </button>
        ))}
      </div>

      {active && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/90 p-4"
          onClick={() => setActiveIndex(null)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              <Image src={active.src} alt={active.alt} fill sizes="90vw" quality={95} className="object-cover" />
            </div>
            <p className="mt-3 text-center text-sm text-white">
              {active.caption}, {active.serviceType}
            </p>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setActiveIndex(null)}
              aria-label="Close image"
              className="absolute -top-3 -right-3 flex size-10 items-center justify-center rounded-full bg-white text-navy-950"
            >
              <X className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length))}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy-950"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => (i === null ? null : (i + 1) % filtered.length))}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy-950"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
