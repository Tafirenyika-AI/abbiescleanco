import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { business } from "@/lib/data/business";

/**
 * Public, no-auth opt-out link included in every prospecting outreach email (see
 * buildDraftForProspect in prospectStore.ts). The id in the URL is the prospect's own cuid --
 * unguessable (same reasoning as /api/files/[id]'s own public-by-design id), so no separate
 * token/migration is needed. One click marks the prospect DO_NOT_CONTACT immediately; no mailbox
 * access or reply-parsing involved. Real, honored, immediate -- the whole point of this route.
 */
function page(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${business.name}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f4f6f8; margin: 0; padding: 0; }
    .card { max-width: 420px; margin: 80px auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(15,23,42,0.08); text-align: center; }
    h1 { font-size: 18px; color: #0f172a; margin: 0 0 12px; }
    p { color: #475569; font-size: 14px; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${business.name}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDatabaseConfigured || !prisma) {
    return new NextResponse(page("Something went wrong on our end. Please reply to the email directly and we'll take care of it."), { status: 500, headers: { "Content-Type": "text/html" } });
  }

  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) {
    return new NextResponse(page("This link isn't valid, but if you'd like us to stop reaching out, just reply to the email directly."), { status: 404, headers: { "Content-Type": "text/html" } });
  }

  if (prospect.status !== "DO_NOT_CONTACT") {
    await prisma.prospect.update({ where: { id }, data: { status: "DO_NOT_CONTACT", notes: [prospect.notes, "Opted out via the one-click link in an outreach email."].filter(Boolean).join("\n") } });
  }

  return new NextResponse(page("You won't hear from us again. Sorry for the bother, and thanks for letting us know."), { status: 200, headers: { "Content-Type": "text/html" } });
}
