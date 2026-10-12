import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { addDocumentFile } from "@/lib/server/documentStore";
import { saveUploadedDocument, UploadError } from "@/lib/server/upload";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_DOCUMENTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });

  try {
    const { fileId } = await saveUploadedDocument(file);
    const result = await addDocumentFile(id, { fileId, filename: file.name.slice(0, 200), contentType: file.type });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    throw e;
  }
}
