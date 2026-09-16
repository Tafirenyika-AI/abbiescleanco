import { Phone, CalendarCheck, MessageCircle } from "lucide-react";
import { telHref, whatsappLink } from "@/lib/data/business";

export default function MobileActionBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 md:hidden">
      <div className="grid grid-cols-3">
        <a
          href={telHref()}
          className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-navy-900 active:bg-surface-100"
          data-analytics="phone-click"
        >
          <Phone className="size-5" aria-hidden />
          Call
        </a>
        <a
          href="/estimate"
          className="flex flex-col items-center gap-0.5 bg-teal-500 py-2.5 text-xs font-semibold text-navy-950 active:bg-teal-400"
          data-analytics="estimate-click"
        >
          <CalendarCheck className="size-5" aria-hidden />
          Estimate
        </a>
        <a
          href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-navy-900 active:bg-surface-100"
          data-analytics="whatsapp-click"
        >
          <MessageCircle className="size-5" aria-hidden />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
