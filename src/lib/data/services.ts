export type ServiceId =
  | "standard-cleaning"
  | "deep-cleaning"
  | "move-in-cleaning"
  | "move-out-cleaning"
  | "bathroom-deep-cleaning"
  | "kitchen-deep-cleaning"
  | "laundry-organization"
  | "residential-cleaning"
  | "commercial-cleaning";

export interface Service {
  id: ServiceId;
  name: string;
  shortDescription: string;
  forWho: string;
  included: string[];
  addOns: string[];
  recommendedFrequency: string;
  prepare: string[];
  image: string;
  imageAlt: string;
  category: "home" | "specialty" | "commercial";
}

export const services: Service[] = [
  {
    id: "standard-cleaning",
    name: "Standard Cleaning",
    shortDescription: "Reliable, recurring upkeep that keeps every room feeling fresh between deeper visits.",
    forWho: "Homeowners who want consistent, dependable upkeep on a regular schedule.",
    included: [
      "Dusting all reachable surfaces",
      "Vacuuming and mopping floors",
      "Kitchen counters and appliance exteriors",
      "Bathroom cleaning and sanitizing",
      "Trash removal",
      "Making beds and general tidying",
    ],
    addOns: ["Inside refrigerator", "Inside oven", "Interior windows", "Laundry"],
    recommendedFrequency: "Weekly or every two weeks for the best results between visits.",
    prepare: ["Pick up personal items and clutter", "Secure pets in a comfortable space", "Point out any areas needing special attention"],
    image: "/images/service-standard.png",
    imageAlt: "Gloved hand wiping down a kitchen counter during a standard cleaning visit",
    category: "home",
  },
  {
    id: "deep-cleaning",
    name: "Deep Cleaning",
    shortDescription: "A thorough, top-to-bottom reset that reaches the corners a regular clean doesn't.",
    forWho: "Homes that haven't been professionally cleaned in a while, or anyone wanting a true reset.",
    included: [
      "Everything in Standard Cleaning",
      "Baseboards and trim",
      "Inside major appliances (oven, fridge)",
      "Detailed bathroom scrubbing, grout and fixtures",
      "Hard-to-reach and behind-furniture areas",
    ],
    addOns: ["Interior windows", "Inside cabinets", "Pet-hair treatment", "Baseboards detail pass"],
    recommendedFrequency: "A great starting point before switching to Standard Cleaning, or seasonally.",
    prepare: ["Clear countertops and floors as much as possible", "Let us know about fragile or high-value items"],
    image: "/images/service-deep.webp",
    imageAlt: "Bright, freshly deep-cleaned bathroom with glass shower enclosure",
    category: "home",
  },
  {
    id: "move-in-cleaning",
    name: "Move-In Cleaning",
    shortDescription: "Start life in a new place on a truly clean slate, before furniture arrives.",
    forWho: "New homeowners and renters preparing a space before move-in day.",
    included: [
      "Full interior deep clean of every room",
      "Inside cabinets, drawers, and closets",
      "Inside appliances",
      "Baseboards, trim, and light fixtures",
      "Sanitizing of kitchens and bathrooms",
    ],
    addOns: ["Interior windows", "Inside garage or storage areas", "Same-day / urgent service"],
    recommendedFrequency: "One-time, timed before your move-in date.",
    prepare: ["Confirm the property is empty or note which rooms are accessible", "Share access instructions (lockbox, key, gate code)"],
    image: "/images/service-movein.png",
    imageAlt: "Empty hallway and door in a home ready for a move-in cleaning",
    category: "specialty",
  },
  {
    id: "move-out-cleaning",
    name: "Move-Out Cleaning",
    shortDescription: "A detailed clean that helps homes show well and supports deposit returns.",
    forWho: "Tenants and homeowners preparing a property for handoff, showing, or sale.",
    included: [
      "Everything in Deep Cleaning",
      "Inside cabinets, drawers, and closets",
      "Interior windows",
      "Detailed top-to-bottom cleaning of every room",
    ],
    addOns: ["Carpet spot treatment referral", "Garage sweep", "Same-day / urgent service"],
    recommendedFrequency: "One-time, scheduled around your move-out or closing date.",
    prepare: ["Remove personal belongings ahead of the visit where possible", "Confirm parking and building access"],
    image: "/images/service-movein.png",
    imageAlt: "Empty room ready for a move-out cleaning",
    category: "specialty",
  },
  {
    id: "bathroom-deep-cleaning",
    name: "Bathroom Deep Cleaning",
    shortDescription: "Intensive attention for tile, grout, fixtures, and mirrors.",
    forWho: "Anyone who wants bathrooms brought back to a like-new shine.",
    included: [
      "Tile and grout scrubbing",
      "Toilet, tub, and shower sanitizing",
      "Fixtures, mirrors, and glass polished",
      "Floors washed and disinfected",
    ],
    addOns: ["Grout treatment", "Hard-water stain treatment"],
    recommendedFrequency: "Pairs well with any Standard or Deep Cleaning visit.",
    prepare: ["Clear personal care items from counters and tubs"],
    image: "/images/service-bathroom.png",
    imageAlt: "Freshly cleaned bathroom shower with glass enclosure",
    category: "specialty",
  },
  {
    id: "kitchen-deep-cleaning",
    name: "Kitchen Deep Cleaning",
    shortDescription: "Appliance interiors, cabinet fronts, and backsplashes, done right.",
    forWho: "Kitchens that need degreasing and detail work beyond routine wiping.",
    included: [
      "Appliance exteriors and interiors on request",
      "Cabinet fronts degreased",
      "Backsplash and counters scrubbed",
      "Sink and fixtures polished",
    ],
    addOns: ["Inside oven", "Inside refrigerator", "Inside cabinets"],
    recommendedFrequency: "Pairs well with any Standard or Deep Cleaning visit.",
    prepare: ["Clear countertops of small appliances and dishes"],
    image: "/images/service-kitchen.png",
    imageAlt: "Modern kitchen counters and cabinetry after a deep clean",
    category: "specialty",
  },
  {
    id: "laundry-organization",
    name: "Laundry and Organization",
    shortDescription: "Washing, folding, and thoughtful organizing for closets and shared spaces.",
    forWho: "Busy households that want laundry handled and spaces put back in order.",
    included: ["Washing, drying, and folding", "Linens and towels", "Closet and shelf organizing"],
    addOns: ["Seasonal closet swap", "Organizing supplies (bins/labels) on request"],
    recommendedFrequency: "Add to any recurring visit, or schedule standalone.",
    prepare: ["Point out preferred detergent or fabric-care instructions"],
    image: "/images/service-laundry.png",
    imageAlt: "Neatly organized closet with folded linens",
    category: "specialty",
  },
  {
    id: "residential-cleaning",
    name: "Residential Cleaning",
    shortDescription: "Whole-home cleaning plans built around your household's rhythm.",
    forWho: "Families and individuals who want a dependable, ongoing home-cleaning partner.",
    included: [
      "Customized room-by-room cleaning plan",
      "Consistent, familiar visit routine",
      "Pet- and family-conscious product choices on request",
    ],
    addOns: ["Any service add-on listed across our offerings"],
    recommendedFrequency: "Weekly, every two weeks, every four weeks, or a custom schedule.",
    prepare: ["Share any pets, allergies, or access notes when you request your estimate"],
    image: "/images/service-residential.png",
    imageAlt: "Comfortable, tidy living room after a residential cleaning visit",
    category: "home",
  },
  {
    id: "commercial-cleaning",
    name: "Commercial Cleaning",
    shortDescription: "Clean, professional workspaces for offices and small commercial spaces.",
    forWho: "Small offices and commercial spaces in Spokane Valley wanting a reliable cleaning partner.",
    included: [
      "Workspaces and common areas",
      "Kitchens and break rooms",
      "Restrooms",
      "High-touch surface sanitizing",
    ],
    addOns: ["After-hours scheduling", "Custom frequency plans"],
    recommendedFrequency: "Weekly or bi-weekly, tailored to your business hours.",
    prepare: ["Share building access details and any security requirements"],
    image: "/images/hero-dining-room.jpg",
    imageAlt: "Clean, organized shared workspace",
    category: "commercial",
  },
];

export function getService(id: string) {
  return services.find((s) => s.id === id);
}

export function isServiceId(id: string): id is ServiceId {
  return services.some((s) => s.id === id);
}
