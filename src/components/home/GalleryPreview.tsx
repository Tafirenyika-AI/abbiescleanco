import Image from "next/image";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { galleryItems } from "@/lib/data/gallery";

export default function GalleryPreview() {
  const items = galleryItems.slice(0, 6);

  return (
    <Section className="bg-surface-50" ariaLabelledby="gallery-heading">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>A look at our work</Eyebrow>
          <h2 id="gallery-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
            Fresh, cared-for spaces
          </h2>
        </div>
        <Button href="/gallery" variant="outline">
          View full gallery
        </Button>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((item, i) => (
          <div key={item.id} className="relative aspect-square overflow-hidden rounded-2xl">
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(min-width: 640px) 30vw, 45vw"
              className="object-cover"
              loading={i < 3 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
