import type { MetadataRoute } from "next";
import { services } from "@/lib/data/services";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://abbiescleanco.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/services",
    "/checklist",
    "/estimate",
    "/about",
    "/gallery",
    "/reviews",
    "/contact",
  ];

  const policyRoutes = [
    "/policies/privacy",
    "/policies/terms",
    "/policies/cancellation",
    "/policies/satisfaction",
    "/policies/accessibility",
  ];

  const serviceRoutes = services.map((s) => `/services/${s.id}`);

  const now = new Date();

  return [...staticRoutes, ...serviceRoutes, ...policyRoutes].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/estimate" ? 0.9 : 0.7,
  }));
}
