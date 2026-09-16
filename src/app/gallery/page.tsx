import type { Metadata } from "next";
import Section, { Eyebrow } from "@/components/ui/Section";
import GalleryGrid from "@/components/gallery/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A look at the fresh, cared-for spaces we clean throughout Spokane Valley, WA.",
  alternates: { canonical: "/gallery" },
};

export default function GalleryPage() {
  return (
    <>
      <Section className="bg-navy-950 py-14 sm:py-16">
        <div className="max-w-2xl">
          <Eyebrow>Gallery</Eyebrow>
          <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">Our work</h1>
          <p className="mt-4 text-surface-200">
            A look at the spaces we&apos;ve cleaned. Filter by room, or tap any photo for a closer
            look.
          </p>
        </div>
      </Section>

      <Section>
        <GalleryGrid />
      </Section>
    </>
  );
}
