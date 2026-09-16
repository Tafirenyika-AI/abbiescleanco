import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { clsx } from "clsx";
import type { Service } from "@/lib/data/services";
import { serviceIcons } from "@/lib/serviceIcons";

const categoryLabels: Record<Service["category"], string> = {
  home: "Home",
  specialty: "Specialty",
  commercial: "Commercial",
};

export default function ServiceCard({
  service,
  featured = false,
  priority = false,
}: {
  service: Service;
  featured?: boolean;
  priority?: boolean;
}) {
  const Icon = serviceIcons[service.id];

  return (
    <Link
      href={`/services/${service.id}`}
      className={clsx(
        "group relative flex w-full shrink-0 snap-start overflow-hidden rounded-3xl shadow-md ring-1 ring-navy-950/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
        featured ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-[4/5]"
      )}
    >
      <Image
        src={service.image}
        alt={service.imageAlt}
        fill
        priority={priority}
        quality={90}
        sizes={featured ? "(min-width: 1024px) 62vw, 90vw" : "(min-width: 1024px) 28vw, 80vw"}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
        loading={priority ? undefined : "lazy"}
      />

      {/* Always-on gradient keeps text legible; deepens further on hover for a subtle "spotlight" effect. */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/95 via-navy-950/35 to-navy-950/0 transition-opacity duration-300 group-hover:from-navy-950/95 group-hover:via-navy-950/55" />

      <div className="relative flex items-start justify-between p-4 sm:p-5">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md ring-1 ring-white/20">
          {categoryLabels[service.category]}
        </span>
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-teal-300 backdrop-blur-md ring-1 ring-white/15">
          <Icon className="size-5" aria-hidden />
        </span>
      </div>

      <div className="relative mt-auto flex w-full flex-col gap-1.5 p-5 pt-0 sm:p-6 sm:pt-0">
        <h3 className={clsx("font-display font-semibold text-white", featured ? "text-2xl sm:text-3xl" : "text-lg")}>
          {service.name}
        </h3>
        <p className={clsx("text-white/80", featured ? "max-w-md text-sm sm:text-base" : "line-clamp-2 text-sm")}>
          {service.shortDescription}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-teal-300">
          Explore
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
