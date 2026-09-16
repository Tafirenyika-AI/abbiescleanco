export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  caption: string;
  serviceType: string;
  category: "kitchen" | "bathroom" | "living" | "hallway" | "laundry";
}

// Genuine company photography is limited to the two home photos and the
// founder photo pulled from the live site (see CLIENT_CONFIRMATION_CHECKLIST.md).
// The remaining images were already published on the live site as general
// service photography; none are presented here as verified before/after pairs.
export const galleryItems: GalleryItem[] = [
  {
    id: "living-room-1",
    src: "/images/hero-living-room.jpg",
    alt: "Bright, tidy living room with natural light after a cleaning visit",
    caption: "A fresh, sunlit living space",
    serviceType: "Standard Cleaning",
    category: "living",
  },
  {
    id: "dining-room-1",
    src: "/images/hero-dining-room.jpg",
    alt: "Clean dining room with wood table and natural light",
    caption: "A dining room ready for family time",
    serviceType: "Residential Cleaning",
    category: "living",
  },
  {
    id: "kitchen-1",
    src: "/images/service-kitchen.png",
    alt: "Modern kitchen counters and cabinetry",
    caption: "Kitchen surfaces, degreased and detailed",
    serviceType: "Kitchen Deep Cleaning",
    category: "kitchen",
  },
  {
    id: "bathroom-1",
    src: "/images/service-bathroom.png",
    alt: "Freshly cleaned glass shower enclosure",
    caption: "Bathroom fixtures and glass, polished",
    serviceType: "Bathroom Deep Cleaning",
    category: "bathroom",
  },
  {
    id: "hallway-1",
    src: "/images/service-movein.png",
    alt: "Bright hallway and door",
    caption: "Move-in ready, top to bottom",
    serviceType: "Move-In Cleaning",
    category: "hallway",
  },
  {
    id: "laundry-1",
    src: "/images/service-laundry.png",
    alt: "Neatly folded linens in an organized closet",
    caption: "Laundry, folded and organized",
    serviceType: "Laundry and Organization",
    category: "laundry",
  },
];
