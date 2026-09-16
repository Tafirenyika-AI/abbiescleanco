import Image from "next/image";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import { galleryItems } from "@/lib/data/gallery";

const aspectCycle = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]"];

export default function GalleryPreview() {
  const items = galleryItems.slice(0, 6);

  return (
    <Section className="bg-surface-50" ariaLabelledby="gallery-heading">
      <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>A look at our work</Eyebrow>
          <h2 id="gallery-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
            Fresh, cared-for spaces
          </h2>
        </div>
        <Button href="/gallery" variant="outline">
          View full gallery
        </Button>
      </Reveal>

      <Reveal delayMs={100} className="mt-10 columns-2 gap-4 sm:columns-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`group relative mb-4 overflow-hidden rounded-2xl break-inside-avoid ${aspectCycle[i % aspectCycle.length]}`}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(min-width: 640px) 30vw, 45vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              loading={i < 3 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-navy-950/0 transition-colors duration-300 group-hover:bg-navy-950/15" />
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
