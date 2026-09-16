import { Phone, Mail, Clock } from "lucide-react";
import { business, telHref, mailtoHref } from "@/lib/data/business";
import Container from "@/components/ui/Container";

export default function TopBar() {
  return (
    <div className="hidden bg-navy-950 text-white sm:block">
      <Container className="flex h-10 items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <a href={telHref()} className="flex items-center gap-1.5 hover:text-teal-300">
            <Phone className="size-3.5" aria-hidden />
            {business.phoneDisplay}
          </a>
          <a href={mailtoHref()} className="flex items-center gap-1.5 hover:text-teal-300">
            <Mail className="size-3.5" aria-hidden />
            {business.email}
          </a>
        </div>
        <div className="flex items-center gap-1.5 text-surface-200">
          <Clock className="size-3.5" aria-hidden />
          Mon–Fri 8–6 · Sat 9–4 · {business.city}, {business.region}
        </div>
      </Container>
    </div>
  );
}
