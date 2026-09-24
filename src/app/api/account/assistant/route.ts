import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/customerContext";
import { resolveCustomerAssistantQuery } from "@/lib/server/customerAssistant";
import { checkRateLimit } from "@/lib/server/rateLimit";

const schema = z.object({ query: z.string().trim().min(1).max(200) });

export async function POST(req: NextRequest) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;

  const rate = await checkRateLimit(`customer-assistant:${auth.ctx.customerId}`, 30, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests, please try again shortly." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ask me something first" }, { status: 400 });

  const result = await resolveCustomerAssistantQuery(auth.ctx.customerId, parsed.data.query);
  return NextResponse.json({ ok: true, result });
}
