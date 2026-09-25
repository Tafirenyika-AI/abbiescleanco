"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Send, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  sender: "CUSTOMER" | "CLEANER";
  body: string;
  createdAt: string;
}

const POLL_MS = 10000;

/** Real two-way text with whoever's on the job, plus a masked call button -- neither side ever
 *  sees the other's real phone number. */
export default function CleanerChat({ bookingId }: { bookingId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/account/bookings/${bookingId}/messages`);
        const data = await res.json();
        if (!cancelled && data.ok) setMessages(data.messages);
      } catch {
        // retry silently next cycle
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bookingId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/account/bookings/${bookingId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text.trim() }),
    });
    const data = await res.json().catch(() => null);
    setSending(false);
    if (!data?.ok) return setError(data?.error || "Couldn't send");
    setText("");
    const res2 = await fetch(`/api/account/bookings/${bookingId}/messages`);
    const data2 = await res2.json();
    if (data2.ok) setMessages(data2.messages);
  }

  async function call() {
    setCalling(true);
    setError("");
    const res = await fetch(`/api/account/bookings/${bookingId}/call`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setCalling(false);
    if (!data?.ok) return setError(data?.error || "Couldn't start the call");
    setError("Calling you now -- answer to be connected.");
  }

  return (
    <div className="mt-3 rounded-xl border border-surface-200 bg-white">
      <div className="flex items-center justify-between border-b border-surface-200 px-3 py-2">
        <p className="text-sm font-semibold text-navy-950">Message your cleaner</p>
        <button type="button" onClick={call} disabled={calling} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {calling ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Phone className="size-3.5" aria-hidden />} Call
        </button>
      </div>

      <div ref={listRef} className="max-h-48 space-y-1.5 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-surface-700">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "CUSTOMER" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.sender === "CUSTOMER" ? "bg-navy-950 text-white" : "bg-surface-100 text-navy-950"}`}>{m.body}</p>
            </div>
          ))
        )}
      </div>

      {error && <p className="px-3 text-xs text-teal-700">{error}</p>}

      <div className="flex gap-2 border-t border-surface-200 p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-surface-200 px-3.5 py-2 text-sm"
        />
        <button type="button" onClick={send} disabled={sending || !text.trim()} className="ios-press inline-flex items-center justify-center rounded-full bg-navy-950 p-2 text-white disabled:opacity-50">
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
