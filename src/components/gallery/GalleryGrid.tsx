"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { galleryItems, type GalleryItem } from "@/lib/data/gallery";

const categories: { key: GalleryItem["category"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "kitchen", label: "Kitchen" },
  { key: "bathroom", label: "Bathroom" },
  { key: "living", label: "Living Spaces" },
  { key: "hallway", label: "Hallway" },
  { key: "laundry", label: "Laundry" },
];

export default function GalleryGrid() {
  const [filter, setFilter] = useState<(typeof categories)[number]["key"]>("all");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(
    () => (filter === "all" ? galleryItems : galleryItems.filter((g) => g.category === filter)),
    [filter]
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter gallery by room">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === c.key ? "bg-teal-500 text-navy-950" : "bg-surface-100 text-navy-900 hover:bg-surface-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="group relative aspect-square overflow-hidden rounded-2xl text-left"
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(min-width: 1024px) 22vw, 45vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/80 to-transparent p-3">
              <span className="block text-xs font-medium text-white">{item.serviceType}</span>
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
              <Image src={active.src} alt={active.alt} fill sizes="90vw" className="object-cover" />
            </div>
            <p className="mt-3 text-center text-sm text-white">
              {active.caption} — {active.serviceType}
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
