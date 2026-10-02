import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyQuoteDetail } from "@/lib/server/clientPortalStore";
import { getContactInfo, getBranding } from "@/lib/server/siteSettings";
import { business } from "@/lib/data/business";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const [quote, contact, branding] = await Promise.all([getMyQuoteDetail(auth.ctx.customerId, id), getContactInfo(), getBranding()]);
  if (!quote) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    quote: {
      ...quote,
      business: { name: business.name, legalName: business.legalName, city: business.city, region: business.region },
      contact,
      logoUrl: branding.logoUrl ?? "/images/logo.png",
    },
  });
}
