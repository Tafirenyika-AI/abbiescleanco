export const business = {
  name: "Abbie's Clean Method LLC",
  legalName: "Abbie's Clean Method LLC",
  tagline: "Professional cleaning services that bring freshness, comfort, and peace of mind to every room.",
  city: "Spokane Valley",
  region: "WA",
  regionFull: "Washington",
  areaServed: [
    "Spokane Valley",
    "Spokane",
    "Liberty Lake",
    "Millwood",
    "Veradale",
    "Greenacres",
    "Opportunity",
  ],
  phoneDisplay: "(650) 400-7983",
  phoneE164: "+16504007983",
  whatsappE164: "16504007983",
  email: "abbiescleanmethod@gmail.com",
  hours: [
    { days: "Monday – Friday", time: "8:00 AM – 6:00 PM" },
    { days: "Saturday", time: "9:00 AM – 4:00 PM" },
    { days: "Sunday", time: "Closed" },
  ],
  hoursSchema: [
    { dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "18:00" },
    { dayOfWeek: ["Saturday"], opens: "09:00", closes: "16:00" },
  ],
  social: {
    tiktok: "https://www.tiktok.com/@abbies_clean_meth",
    // Sourced from the current live site's footer link. This is a WordPress
    // "share/reel" style URL rather than a stable Page URL — confirm with the
    // client that it resolves to the business's actual Facebook Page before launch.
    facebook: "https://facebook.com/share/r/1DSvyHGEy8/?mibextid=wwXIfr",
  },
  founder: {
    firstName: "Abigail",
    story:
      "Abbie's Clean Method LLC was founded by Abigail with a simple mission: to bring the joy of a clean home to families in Spokane Valley.",
  },
} as const;

export function whatsappLink(prefilledMessage: string) {
  const text = encodeURIComponent(prefilledMessage);
  return `https://wa.me/${business.whatsappE164}?text=${text}`;
}

export function telHref() {
  return `tel:${business.phoneE164}`;
}

export function mailtoHref(subject?: string) {
  return subject ? `mailto:${business.email}?subject=${encodeURIComponent(subject)}` : `mailto:${business.email}`;
}
