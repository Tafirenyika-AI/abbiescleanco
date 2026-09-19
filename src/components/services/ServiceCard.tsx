import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { clsx } from "clsx";
import type { Service } from "@/lib/data/services";
import { serviceIcons } from "@/lib/serviceIcons";

const categoryLabels: Record<Service["category"], string> = {
  home: "Home",
  specialty: "Specialty",
  commercial: "Commercial",
};

const MAX_CHIPS = 3;

export default function ServiceCard({
  service,
  priceLabel,
  featured = false,
  priority = false,
}: {
  service: Service;
  /** "Starting at" headline price — see getServicePriceLabel() in lib/pricing.ts. Omitted entirely if not provided. */
  priceLabel?: string;
  featured?: boolean;
  priority?: boolean;
}) {
  const Icon = serviceIcons[service.id];
  const chips = service.included.slice(0, MAX_CHIPS);
  const remaining = service.included.length - chips.length;

  return (
    <Link
      href={`/services/${service.id}`}
      className={clsx(
        "ios-press group flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_2px_24px_rgba(11,31,51,0.08)] ring-1 ring-black/[0.05] hover:shadow-[0_8px_36px_rgba(11,31,51,0.14)]",
        featured ? "sm:flex-row" : "h-full"
      )}
    >
      <div
        className={clsx(
          "relative w-full shrink-0 overflow-hidden",
          featured ? "aspect-[4/3] sm:aspect-square sm:w-2/5" : "aspect-[4/3]"
        )}
      >
        <Image
          src={service.image}
          alt={service.imageAlt}
          fill
          priority={priority}
          quality={90}
          sizes={featured ? "(min-width: 1024px) 32vw, 90vw" : "(min-width: 1024px) 28vw, 80vw"}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          loading={priority ? undefined : "lazy"}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-navy-900 shadow-sm backdrop-blur-sm">
            {categoryLabels[service.category]}
          </span>
          {priceLabel && (
            <span className="rounded-full bg-navy-950/90 px-3 py-1 text-sm font-semibold text-white shadow-sm backdrop-blur-sm">
              {priceLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <Icon className="size-4.5" aria-hidden />
          </span>
          <h3 className={clsx("font-display font-semibold text-navy-950", featured ? "text-xl sm:text-2xl" : "text-lg")}>
            {service.name}
          </h3>
        </div>

        <p className={clsx("mt-2.5 text-surface-700", featured ? "text-sm sm:text-base" : "line-clamp-2 text-sm")}>
          {service.shortDescription}
        </p>

        {chips.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap gap-1.5">
            {chips.map((item) => (
              <li
                key={item}
                className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-navy-700"
              >
                <Check className="size-3 text-teal-600" aria-hidden />
                {item}
              </li>
            ))}
            {remaining > 0 && (
              <li className="inline-flex items-center rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-navy-500">
                +{remaining} more
              </li>
            )}
          </ul>
        )}

        <span className={clsx("flex items-center gap-1 pt-4 text-sm font-semibold text-teal-600", featured ? "mt-4" : "mt-auto")}>
          View details
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
