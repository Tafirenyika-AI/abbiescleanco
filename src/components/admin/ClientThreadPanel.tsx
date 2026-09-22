"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

interface Note { id: string; body: string; author: string; authorName: string | null; kind: string; createdAt: string }
interface Att { id: string; kind: string; url: string; caption: string | null; uploadedBy: string; createdAt: string }
interface PE { id: string; mode: string; low: number | null; high: number | null; hoursLow: number | null; hoursHigh: number | null; serviceId: string | null }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** What the client attached / wrote for this lead or booking, plus a reply box (optionally emailed to them). */
export default function ClientThreadPanel({ leadId, bookingId }: { leadId?: string; bookingId?: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [pes, setPes] = useState<PE[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const qs = bookingId ? `bookingId=${bookingId}` : `leadId=${leadId}`;

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/client-thread?${qs}`);
    if (res.ok) {
      const d = await res.json();
      setNotes(d.notes);
      setAtts(d.attachments);
      setPes(d.photoEstimates ?? []);
    }
    setLoading(false);
  }, [qs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/client-thread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, bookingId, body: text, emailCustomer: email }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Couldn't send");
    setText("");
    await load();
  }

  if (loading) return <p className="text-sm text-admin-text-muted">Loading client notes…</p>;

  return (
    <div className="space-y-3">
      {pes.map((p) => (
        <p key={p.id} className="flex items-start gap-1.5 rounded-lg bg-admin-bg p-2.5 text-xs text-admin-text">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-admin-teal" aria-hidden />
          <span>Photo estimate ({p.mode === "ai" ? "AI-assessed" : "unassessed"}): {p.low != null ? `$${p.low}–$${p.high}` : "manual quote"}{p.hoursLow != null ? ` · ${p.hoursLow}–${p.hoursHigh} h` : ""}. Assessment details are in the notes below.</span>
        </p>
      ))}
      {atts.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {atts.map((a) => (
            <li key={a.id} className={`overflow-hidden rounded-lg bg-admin-bg ${a.kind === "AUDIO" ? "col-span-3 flex items-center px-2 py-1.5" : ""}`}>
              {a.kind === "VIDEO" ? (
                <video src={a.url} controls preload="metadata" className="aspect-square w-full object-cover" />
              ) : a.kind === "AUDIO" ? (
                <audio src={a.url} controls preload="metadata" className="w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url} alt={a.caption || "Client photo"} className="aspect-square w-full object-cover" /></a>
              )}
            </li>
          ))}
        </ul>
      )}
      {notes.length === 0 && atts.length === 0 && <p className="text-sm text-admin-text-muted">The client hasn&apos;t added any notes, photos or videos yet.</p>}
      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-lg p-2.5 text-sm ${n.author === "STAFF" ? "bg-admin-teal/10" : "bg-admin-bg"} text-admin-text`}>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-admin-text-muted">
                {n.kind !== "NOTE" && n.kind !== "AI_ASSESSMENT" ? `${n.kind.replace(/_/g, " ").toLowerCase()} · ` : ""}
                {n.authorName || (n.author === "STAFF" ? "Staff" : "Client")} · {when(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Reply to the client…" className="w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-admin-text-muted"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email them a heads-up</label>
          <button type="button" onClick={send} disabled={busy || !text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Send
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
