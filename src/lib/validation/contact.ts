import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s()+-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  message: z.string().trim().min(5, "Tell us a little more").max(2000),
  isUrgent: z.boolean().default(false),
  emailConsent: z.boolean().default(true),
  // See quote.ts for why this isn't constrained to empty at the schema level.
  _gotcha: z.string().max(200).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactFormValues = z.input<typeof contactSchema>;
