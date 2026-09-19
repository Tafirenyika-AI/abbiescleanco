import { Phone, CalendarCheck, MessageCircle } from "lucide-react";
import { telHref, whatsappLink } from "@/lib/data/business";

/** iOS-style tab bar: frosted glass, hairline top border, home-indicator safe area. */
export default function MobileActionBar() {
  const tab = "ios-press flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-medium text-navy-800/80";
  return (
    <nav
      aria-label="Quick actions"
      className="ios-glass fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch gap-1 px-3 pt-1.5 pb-1">
        <a href={telHref()} className={tab} data-analytics="phone-click">
          <Phone className="size-[22px]" aria-hidden />
          Call
        </a>
        <a
          href="/estimate"
          className="ios-press flex flex-1 flex-col items-center gap-0.5 rounded-2xl bg-teal-500/15 py-1.5 text-[10.5px] font-semibold text-teal-700"
          data-analytics="estimate-click"
        >
          <CalendarCheck className="size-[22px]" aria-hidden />
          Estimate
        </a>
        <a
          href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.")}
          target="_blank"
          rel="noopener noreferrer"
          className={tab}
          data-analytics="whatsapp-click"
        >
          <MessageCircle className="size-[22px]" aria-hidden />
          WhatsApp
        </a>
      </div>
    </nav>
  );
}
