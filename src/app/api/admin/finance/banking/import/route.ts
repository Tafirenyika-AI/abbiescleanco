import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { parseBankCsv, importBankCsv } from "@/lib/server/bankStore";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
    return NextResponse.json({ ok: false, error: "Please upload a .csv file." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: "File is too large (5MB max)." }, { status: 400 });

  const text = await file.text();
  const parsed = parseBankCsv(text);
  if (!parsed.ok || !parsed.rows) return NextResponse.json({ ok: false, error: parsed.error || "Couldn't parse this file." }, { status: 400 });

  const result = await importBankCsv(file.name, parsed.rows, admin.id);
  return NextResponse.json({ ...result, unparseableCount: parsed.unparseableCount ?? 0 }, { status: result.ok ? 200 : 400 });
}
