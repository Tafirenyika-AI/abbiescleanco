export interface Testimonial {
  id: string;
  name: string;
  location: string;
  quote: string;
  avatar?: string;
}

// Sourced verbatim (capitalization/punctuation tidied only) from the current
// live site. Do not alter meaning. Add future reviews through the admin area.
export const testimonials: Testimonial[] = [
  {
    id: "jackie-roman",
    name: "Jackie Roman",
    location: "Spokane Valley, WA",
    quote:
      "I can't say enough good things about Abbie's Cleaning Service. Abbie is professional, dependable, and takes genuine pride in her work.",
    avatar: "/images/testimonial-avatar-1.png",
  },
  {
    id: "ivan-rojas-morales",
    name: "Ivan Rojas Morales",
    location: "Spokane Valley, WA",
    quote:
      "Abbie's Clean Method is awesome. She does a great job and charges a fair price. I highly recommend her.",
    avatar: "/images/testimonial-avatar-2.png",
  },
];
