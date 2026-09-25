import { NextRequest, NextResponse } from "next/server";
import { getCallBridgeTarget } from "@/lib/server/trackingStore";

/**
 * Twilio calls this once the first leg of a bridged call answers, to find out what to do next.
 * The target phone number is never in the URL or any client-visible place -- Twilio only ever
 * gets it by requesting this exact webhook for a call bridge our own server just created.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await getCallBridgeTarget(id);
  const twiml = target
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escapeXml(target)}</Dial></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this call link is no longer valid.</Say><Hangup/></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
