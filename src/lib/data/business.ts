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

/**
 * These three accept an optional live override so pages that fetched the admin-editable contact
 * info (see getContactInfo in siteSettings.ts) can use the real current number/address instead of
 * this file's static fallback. Omit the override and you get the static default, unchanged --
 * every existing call site keeps working exactly as before.
 */
export function whatsappLink(prefilledMessage: string, whatsappE164: string = business.whatsappE164) {
  const text = encodeURIComponent(prefilledMessage);
  return `https://wa.me/${whatsappE164}?text=${text}`;
}

export function telHref(phoneE164: string = business.phoneE164) {
  return `tel:${phoneE164}`;
}

export function mailtoHref(subject?: string, email: string = business.email) {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}
