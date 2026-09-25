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

/** Same idea as the customer's CleanerChat, dark-theme version for this page. */
export default function TrackChat({ token }: { token: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [status, setStatus] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/track/${token}/messages`);
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
  }, [token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setStatus("");
    const res = await fetch(`/api/track/${token}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text.trim() }),
    });
    const data = await res.json().catch(() => null);
    setSending(false);
    if (!data?.ok) return setStatus(data?.error || "Couldn't send");
    setText("");
    const res2 = await fetch(`/api/track/${token}/messages`);
    const data2 = await res2.json();
    if (data2.ok) setMessages(data2.messages);
  }

  async function call() {
    setCalling(true);
    setStatus("");
    const res = await fetch(`/api/track/${token}/call`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setCalling(false);
    if (!data?.ok) return setStatus(data?.error || "Couldn't start the call");
    setStatus("Calling you now -- answer to be connected.");
  }

  return (
    <div className="mt-4 rounded-xl border border-white/15 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/15 px-3 py-2">
        <p className="text-sm font-semibold">Message the client</p>
        <button type="button" onClick={call} disabled={calling} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-navy-950 disabled:opacity-50">
          {calling ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Phone className="size-3.5" aria-hidden />} Call
        </button>
      </div>

      <div ref={listRef} className="max-h-40 space-y-1.5 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-white/50">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "CLEANER" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.sender === "CLEANER" ? "bg-teal-500 text-navy-950" : "bg-white/10 text-white"}`}>{m.body}</p>
            </div>
          ))
        )}
      </div>

      {status && <p className="px-3 text-xs text-teal-300">{status}</p>}

      <div className="flex gap-2 border-t border-white/15 p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-white/20 bg-transparent px-3.5 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button type="button" onClick={send} disabled={sending || !text.trim()} className="ios-press inline-flex items-center justify-center rounded-full bg-teal-500 p-2 text-navy-950 disabled:opacity-50">
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
