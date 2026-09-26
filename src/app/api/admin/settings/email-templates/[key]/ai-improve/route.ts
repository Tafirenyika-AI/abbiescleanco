import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { EMAIL_TEMPLATE_DEFS } from "@/lib/server/emailTemplates";
import { HOUSE_WRITING_STYLE } from "@/lib/aiStyle";

const API_VERSION = "2023-06-01";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const schema = z.object({
  subject: z.string().trim().min(1).max(500),
  html: z.string().trim().min(1).max(20000),
  instruction: z.string().trim().max(1000).optional(),
});

/**
 * Drafts an improved subject/html for one email template -- never saves anything itself. The
 * admin reviews the draft in the editor and explicitly clicks Save, same "AI prepares, human
 * approves" pattern as everywhere else this app uses AI on customer-facing content.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { key } = await params;

  const def = EMAIL_TEMPLATE_DEFS.find((d) => d.key === key);
  if (!def) return NextResponse.json({ ok: false, error: "Unknown template" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  if (!apiKey) return NextResponse.json({ ok: false, error: "Anthropic isn't configured yet, add an API key in Settings → Integrations." }, { status: 400 });

  const variableList = def.variables.map((v) => `{{${v}}}`).join(", ");
  const prompt = [
    `You are rewriting one real email template ("${def.name}") for a residential/commercial cleaning business.`,
    `This template's real variable placeholders are: ${variableList}. Every one of them MUST still appear in your output, exactly as written (same spelling, same double curly braces) -- they get replaced with real data when the email actually sends. Never invent a new placeholder, never remove one of these, never change one's name.`,
    "Keep the HTML valid and keep the existing inline-styled <div> wrapper structure unless there's a good reason to change it.",
    parsed.data.instruction ? `The admin's specific request: ${parsed.data.instruction}` : "Improve the wording -- keep it genuine and on-brand, not generic marketing copy.",
    HOUSE_WRITING_STYLE,
    "Call the draft_email_template tool with your result.",
  ].join("\n");

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        tools: [
          {
            name: "draft_email_template",
            description: "Report the rewritten subject and HTML body.",
            input_schema: {
              type: "object",
              required: ["subject", "html"],
              properties: {
                subject: { type: "string" },
                html: { type: "string" },
              },
            },
          },
        ],
        tool_choice: { type: "tool", name: "draft_email_template" },
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nCurrent subject: ${parsed.data.subject}\n\nCurrent HTML:\n${parsed.data.html}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `AI request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}` }, { status: 502 });
    }
    const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
    const toolUse = data.content?.find((c) => c.type === "tool_use");
    const draft = toolUse?.input as { subject?: unknown; html?: unknown } | undefined;
    if (!draft || typeof draft.subject !== "string" || typeof draft.html !== "string") {
      return NextResponse.json({ ok: false, error: "AI response didn't come back in the expected format" }, { status: 502 });
    }

    // Safety net: if the model dropped a required variable, the sent email would silently show a
    // literal missing value at that spot -- fail loudly here instead, before the admin can save it.
    const combined = `${draft.subject} ${draft.html}`;
    const missing = def.variables.filter((v) => !combined.includes(`{{${v}}}`));
    if (missing.length > 0) {
      return NextResponse.json({ ok: false, error: `AI draft is missing required placeholder(s): ${missing.map((v) => `{{${v}}}`).join(", ")}. Try again, or ask for a smaller change.` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, subject: draft.subject, html: draft.html });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "AI request failed" }, { status: 502 });
  }
}
