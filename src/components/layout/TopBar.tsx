import { Phone, Mail, Clock } from "lucide-react";
import { business, telHref, mailtoHref } from "@/lib/data/business";
import type { ContactInfo, BusinessHoursRow } from "@/lib/server/siteSettings";
import Container from "@/components/ui/Container";

export default function TopBar({ contact, hours }: { contact: ContactInfo; hours: BusinessHoursRow[] }) {
  const hoursLabel = hours.map((h) => `${h.days} ${h.time}`).join(" · ") || "Contact us for hours";

  return (
    <div className="public-topbar hidden sm:block">
      <Container className="flex h-10 items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <a href={telHref(contact.phoneE164)} className="flex items-center gap-1.5 hover:text-teal-300">
            <Phone className="size-3.5" aria-hidden />
            {contact.phoneDisplay}
          </a>
          <a href={mailtoHref(undefined, contact.email)} className="flex items-center gap-1.5 hover:text-teal-300">
            <Mail className="size-3.5" aria-hidden />
            {contact.email}
          </a>
        </div>
        <div className="hours-label flex items-center gap-1.5 truncate">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{hoursLabel} · {business.city}, {business.region}</span>
        </div>
      </Container>
    </div>
  );
}
