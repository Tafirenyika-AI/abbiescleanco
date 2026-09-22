"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mic, Send, Trash2, Video } from "lucide-react";
import type { AttachmentItem, NoteItem } from "@/lib/server/clientPortalStore";

const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/** Downscale big phone photos in the browser so uploads are fast and fit serverless body limits. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC the browser can't decode -- the server re-encodes it
  }
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Notes + photos + videos attached to one request or booking. This is how a customer shows the
 * team exactly what they want (a stained rug, a "please skip this room", a walkthrough video)
 * when they can't be home.
 */
export default function MediaThread({ target, readOnly = false }: { target: { leadId?: string; bookingId?: string }; readOnly?: boolean }) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qs = target.bookingId ? `bookingId=${target.bookingId}` : `leadId=${target.leadId}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/account/thread?${qs}`);
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes);
      setAttachments(data.attachments);
    }
    setLoading(false);
  }, [qs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function sendNote() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/thread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, body: text }) });
    setBusy(false);
    if (!res.ok) return setError("Couldn't send your note. Please try again.");
    setText("");
    await load();
  }

  async function uploadVideoDirect(file: File): Promise<boolean> {
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`client-media/${crypto.randomUUID()}-${file.name}`, file, { access: "public", handleUploadUrl: "/api/account/media/token" });
      const res = await fetch("/api/account/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, url: blob.url, mimeType: file.type, sizeBytes: file.size }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    for (const original of Array.from(files)) {
      if (original.type.startsWith("video/") && original.size > MAX_VIDEO_BYTES) {
        setError("Videos can be up to 60MB — try a shorter clip.");
        continue;
      }
      if (original.type.startsWith("audio/") && original.size > MAX_AUDIO_BYTES) {
        setError("Voice notes can be up to 15MB.");
        continue;
      }
      const isVideo = original.type.startsWith("video/");
      if (isVideo && (await uploadVideoDirect(original))) continue;
      const file = isVideo ? original : await compressImage(original);
      const form = new FormData();
      form.set("file", file);
      if (target.leadId) form.set("leadId", target.leadId);
      if (target.bookingId) form.set("bookingId", target.bookingId);
      const res = await fetch("/api/account/media", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (res.status === 413 ? "That file is too large to upload from here." : "Upload failed."));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/account/media/${id}`, { method: "DELETE" });
    if (res.ok) setAttachments((a) => a.filter((x) => x.id !== id));
  }

  if (loading) return <p className="text-sm text-surface-700">Loading…</p>;

  return (
    <div className="space-y-4">
      {attachments.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {attachments.map((a) => (
            <li key={a.id} className={`relative overflow-hidden rounded-xl bg-surface-100 ring-1 ring-black/5 ${a.kind === "AUDIO" ? "col-span-3 flex items-center px-3 py-2 sm:col-span-4" : ""}`}>
              {a.kind === "VIDEO" ? (
                <video src={a.url} controls preload="metadata" className="aspect-square w-full object-cover" />
              ) : a.kind === "AUDIO" ? (
                <audio src={a.url} controls preload="metadata" className="w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url} alt={a.caption || "Uploaded photo"} className="aspect-square w-full object-cover" /></a>
              )}
              {a.uploadedBy === "CUSTOMER" && !readOnly && (
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  aria-label="Remove file"
                  className={a.kind === "AUDIO" ? "ios-press ml-2 shrink-0 rounded-full bg-surface-200 p-1.5 text-navy-950" : "ios-press absolute right-1 top-1 rounded-full bg-black/55 p-1.5 text-white"}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${n.author === "STAFF" ? "bg-teal-100/60 text-navy-950" : "bg-surface-100 text-navy-950"}`}>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-surface-700">{n.author === "STAFF" ? n.authorName || "Abbie's Clean Method" : "You"} · {when(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Anything we should know? e.g. gate code, pets, areas to focus on or skip, where the key is…"
            className="w-full rounded-2xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm text-navy-950"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={sendNote} disabled={busy || !text.trim()} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Send note
            </button>
            <label className="ios-press inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-100 px-4 py-2 text-sm font-semibold text-navy-950">
              <Camera className="size-4" aria-hidden /> <Video className="size-4" aria-hidden /> <Mic className="size-4" aria-hidden /> Add photos / video / voice note
              <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.wav,.ogg,.m4a" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <p className="text-xs text-surface-700">Shared with our team only. Location data is stripped from photos automatically.</p>
        </div>
      )}
    </div>
  );
}
