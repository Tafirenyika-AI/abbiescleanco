import {
  Sparkles,
  SprayCan,
  DoorOpen,
  Boxes,
  ShowerHead,
  UtensilsCrossed,
  Shirt,
  Home,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { ServiceId } from "@/lib/data/services";

/** A small icon "badge" per service — same treatment across cards, service detail pages, and checklists. */
export const serviceIcons: Record<ServiceId, LucideIcon> = {
  "standard-cleaning": Sparkles,
  "deep-cleaning": SprayCan,
  "move-in-cleaning": DoorOpen,
  "move-out-cleaning": Boxes,
  "bathroom-deep-cleaning": ShowerHead,
  "kitchen-deep-cleaning": UtensilsCrossed,
  "laundry-organization": Shirt,
  "residential-cleaning": Home,
  "commercial-cleaning": Building2,
};
