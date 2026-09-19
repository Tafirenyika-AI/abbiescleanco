export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  caption: string;
  serviceType: string;
  category: "kitchen" | "bathroom" | "living" | "hallway" | "laundry" | "team";
}

// Real photography supplied by the business owner from actual jobs. Captions
// stay descriptive rather than claiming results: the oven pair carries its own
// "Before"/"After" labels from the owner; nothing else is presented as a
// verified before/after.
export const galleryItems: GalleryItem[] = [
  { id: "oven-before", src: "/images/gallery-oven-before.jpg", alt: "Oven with baked-on grease, before cleaning", caption: "Oven, before", serviceType: "Deep Cleaning", category: "kitchen" },
  { id: "oven-after", src: "/images/gallery-oven-after.jpg", alt: "The same oven with clean racks and a clear door, after cleaning", caption: "Oven, after", serviceType: "Deep Cleaning", category: "kitchen" },
  { id: "cooktop-streaks", src: "/images/gallery-cooktop-before.jpg", alt: "Glass cooktop with streaks and residue", caption: "Glass cooktop, streaks and residue", serviceType: "Kitchen Deep Cleaning", category: "kitchen" },
  { id: "cooktop-clean", src: "/images/service-kitchen.jpg", alt: "Glass-top electric cooktop with a clean, clear surface", caption: "Glass cooktop, polished", serviceType: "Kitchen Deep Cleaning", category: "kitchen" },
  { id: "kitchen-smeg", src: "/images/gallery-smeg-kitchen.jpg", alt: "Cream kettle and toaster on a granite counter under gray cabinets", caption: "Counters and backsplash, wiped down", serviceType: "Standard Cleaning", category: "kitchen" },
  { id: "kitchen-island", src: "/images/service-standard.jpg", alt: "Kitchen with a granite island, wood cabinets and hardwood-look floors", caption: "A kitchen kept fresh", serviceType: "Standard Cleaning", category: "kitchen" },
  { id: "kitchen-gray", src: "/images/service-movein.jpg", alt: "Open kitchen with gray cabinets and stainless steel appliances", caption: "Open kitchen, ready to move in", serviceType: "Move-In Cleaning", category: "kitchen" },
  { id: "shower-glass", src: "/images/service-bathroom.jpg", alt: "Clean glass shower enclosure with tile walls", caption: "Shower glass and tile", serviceType: "Bathroom Deep Cleaning", category: "bathroom" },
  { id: "shower-duster", src: "/images/gallery-shower-duster.jpg", alt: "Microfiber duster held up beside a glass shower door", caption: "Detail work, corner to corner", serviceType: "Bathroom Deep Cleaning", category: "bathroom" },
  { id: "living-room", src: "/images/service-residential.jpg", alt: "Living room with leather recliners, a large TV and a patterned rug", caption: "A tidy living space", serviceType: "Residential Cleaning", category: "living" },
  { id: "living-sunlit", src: "/images/hero-living-room.jpg", alt: "Bright, tidy living room with natural light after a cleaning visit", caption: "A fresh, sunlit living space", serviceType: "Standard Cleaning", category: "living" },
  { id: "laundry-1", src: "/images/service-laundry.png", alt: "Neatly folded linens in an organized closet", caption: "Laundry, folded and organized", serviceType: "Laundry and Organization", category: "laundry" },
  { id: "team-abbie", src: "/images/team-at-work.jpg", alt: "Abbie in an Abbie's Clean Method shirt with her cleaning caddy", caption: "Abbie, on the job", serviceType: "Our team", category: "team" },
  { id: "team-supplies", src: "/images/service-deep.jpg", alt: "Mop bucket, broom, dustpan, gloves and cleaning products", caption: "The kit that comes with us", serviceType: "Our team", category: "team" },
];
