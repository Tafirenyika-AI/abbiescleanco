import { NextRequest, NextResponse } from "next/server";
import { contactSchema } from "@/lib/validation/contact";
import { sendEmail } from "@/lib/server/email";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { createContactMessage } from "@/lib/server/contactMessageStore";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { business } from "@/lib/data/business";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await checkRateLimit(`contact:${ip}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  if (input._gotcha) {
    return NextResponse.json({ ok: true });
  }

  await createContactMessage({
    name: input.name,
    email: input.email,
    phone: input.phone || undefined,
    message: input.message,
    isUrgent: input.isUrgent,
  });

  await notifyAdmins(
    "NEW_MESSAGE",
    `New message: ${input.name}${input.isUrgent ? " (urgent)" : ""}`,
    input.message.slice(0, 140),
    "/admin/messages"
  );

  await sendEmail({
    to: business.email,
    replyTo: input.email,
    subject: `${input.isUrgent ? "[URGENT] " : ""}New contact form message from ${input.name}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2>New contact message${input.isUrgent ? " — marked urgent" : ""}</h2>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        ${input.phone ? `<p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>` : ""}
        <p><strong>Message:</strong><br/>${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>
      </div>
    `,
  });

  if (input.emailConsent) {
    await sendEmail({
      to: input.email,
      subject: "We received your message",
      html: `
        <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
          <h2>Thanks for reaching out!</h2>
          <p>We received your message and will get back to you soon${input.isUrgent ? " — we saw this is urgent and will prioritize it" : ""}.</p>
          <p>Need us right away? Call or text ${business.phoneDisplay}.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
