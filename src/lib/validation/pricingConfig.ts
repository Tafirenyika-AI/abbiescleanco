import { z } from "zod";
import { serviceIds } from "./quote";

const nonNegativeNumber = z.coerce.number().min(0, "Must be 0 or more");

export const servicePricingSchema = z.object({
  baseLow: nonNegativeNumber,
  baseHigh: nonNegativeNumber,
  baseBedrooms: nonNegativeNumber,
  baseBathrooms: nonNegativeNumber,
  baseSqFt: nonNegativeNumber,
  perExtraBedroom: nonNegativeNumber,
  perExtraBathroom: nonNegativeNumber,
  perExtraSqFt: nonNegativeNumber,
  manualQuoteAboveSqFt: nonNegativeNumber,
  durationHoursLow: nonNegativeNumber,
  durationHoursHigh: nonNegativeNumber,
}).refine((v) => v.baseHigh >= v.baseLow, {
  message: "High end must be greater than or equal to the low end",
  path: ["baseHigh"],
});

export const addOnDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Required")
    .max(60)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, - and _ only"),
  label: z.string().trim().min(1, "Required").max(120),
  low: nonNegativeNumber,
  high: nonNegativeNumber,
}).refine((v) => v.high >= v.low, {
  message: "High end must be greater than or equal to the low end",
  path: ["high"],
});

export const pricingConfigSchema = z
  .object({
    services: z.record(z.enum(serviceIds), servicePricingSchema),
    addOns: z.array(addOnDefinitionSchema).max(50),
    conditionMultiplier: z.object({
      light: z.coerce.number().min(0).max(5),
      normal: z.coerce.number().min(0).max(5),
      heavy: z.coerce.number().min(0).max(5),
      "very-heavy": z.coerce.number().min(0).max(5),
    }),
    recurringDiscountsEnabled: z.boolean(),
    recurringDiscountRates: z.object({
      "one-time": z.coerce.number().min(0).max(1),
      weekly: z.coerce.number().min(0).max(1),
      biweekly: z.coerce.number().min(0).max(1),
      "every-4-weeks": z.coerce.number().min(0).max(1),
      custom: z.coerce.number().min(0).max(1),
    }),
  })
  .refine((v) => new Set(v.addOns.map((a) => a.key)).size === v.addOns.length, {
    message: "Add-on keys must be unique",
    path: ["addOns"],
  });

export type PricingConfigInput = z.infer<typeof pricingConfigSchema>;
export type PricingConfigFormValues = z.input<typeof pricingConfigSchema>;
