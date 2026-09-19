import type { Metadata } from "next";
import Section, { Eyebrow } from "@/components/ui/Section";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import { listGalleryItems } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Gallery",
  description: "A look at the fresh, cared-for spaces we clean throughout Spokane Valley, WA.",
  alternates: { canonical: "/gallery" },
};

// Gallery is admin-editable from /admin/content — revalidate frequently
// rather than only rebuilding on deploy.
export const revalidate = 60;

export default async function GalleryPage() {
  const dbItems = await listGalleryItems(true);
  const items = dbItems
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      id: g.id,
      src: g.imageUrl,
      alt: g.altText,
      caption: g.caption || "",
      serviceType: g.serviceType || "",
      category: (g.category || "living") as "kitchen" | "bathroom" | "living" | "hallway" | "laundry" | "team",
    }));

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
        <GalleryGrid items={items} />
      </Section>
    </>
  );
}
