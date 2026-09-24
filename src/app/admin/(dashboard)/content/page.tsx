import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getServicesContent } from "@/lib/server/servicesContent";
import { listFaqs, listGalleryItems, listServiceAreas } from "@/lib/server/content";
import { isDatabaseConfigured } from "@/lib/db";
import ContentTabs from "@/components/admin/content/ContentTabs";
import ServicesContentManager from "@/components/admin/content/ServicesContentManager";
import FaqsManager from "@/components/admin/content/FaqsManager";
import GalleryManager from "@/components/admin/content/GalleryManager";
import ServiceAreasManager from "@/components/admin/content/ServiceAreasManager";

export default async function AdminContentPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_CONTENT")) {
    redirect("/admin");
  }

  const [services, faqs, gallery, areas] = await Promise.all([
    getServicesContent(),
    listFaqs(),
    listGalleryItems(),
    listServiceAreas(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Content</h1>
      <p className="mt-1 text-sm text-slate-600">
        Edit what&apos;s actually shown on the public site: service descriptions, FAQs, gallery
        photos, and the list of areas you serve.
      </p>
      {!isDatabaseConfigured && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-slate-900">
          No DATABASE_URL is configured, content edits save to local mock files instead of Postgres,
          and some actions (new FAQs, gallery images, service areas) are disabled.
        </p>
      )}

      <div className="mt-6">
        <ContentTabs
          panels={{
            Services: <ServicesContentManager services={services} />,
            FAQs: <FaqsManager initialFaqs={faqs} />,
            Gallery: <GalleryManager initialItems={gallery} />,
            "Service areas": <ServiceAreasManager initialAreas={areas} />,
          }}
        />
      </div>
    </div>
  );
}
