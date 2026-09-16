import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listTeamMembers, createTeamMember } from "@/lib/server/teamStore";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.string().trim().max(60).optional(),
  workingHours: z.string().trim().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const members = await listTeamMembers();
  return NextResponse.json({ ok: true, members });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const member = await createTeamMember({
    name: parsed.data.name,
    email: parsed.data.email || undefined,
    phone: parsed.data.phone || undefined,
    role: parsed.data.role || undefined,
    workingHours: parsed.data.workingHours || undefined,
  });
  return NextResponse.json({ ok: true, id: member.id });
}
