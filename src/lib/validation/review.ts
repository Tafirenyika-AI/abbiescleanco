import { z } from "zod";

export const reviewSubmissionSchema = z.object({
  authorName: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  quote: z.string().trim().min(10, "Tell us a bit more about your experience").max(2000),
  rating: z.coerce.number().int().min(1).max(5),
  companyWebsite: z.string().max(200).optional().or(z.literal("")),
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
export type ReviewSubmissionFormValues = z.input<typeof reviewSubmissionSchema>;
