"use client";

import { useState } from "react";
import { MessageCircleQuestion, X, Loader2, Sparkles } from "lucide-react";

const EXAMPLES = ["Next appointment", "What do I owe?", "My bookings", "My quotes"];

/** Persistent floating assistant on the customer portal -- blueprint section 4's "universal assistant." Real, scoped-to-you answers only; no model, no guessing. */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuery("");
    setBusy(true);
    const res = await fetch("/api/account/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: text }) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    setMessages((m) => [...m, { role: "assistant", text: data?.ok ? data.result.text : "Something went wrong — please try again." }]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open Abbie Assistant"}
        className="ios-press fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-navy-950 text-white shadow-[0_8px_24px_rgba(11,31,51,0.35)] sm:bottom-6"
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircleQuestion className="size-6" aria-hidden />}
      </button>

      {open && (
        <div className="ios-sheet-in fixed inset-x-3 bottom-[calc(10.5rem+env(safe-area-inset-bottom))] z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_16px_48px_rgba(11,31,51,0.3)] ring-1 ring-black/5 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-96">
          <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-teal-100 text-teal-700"><Sparkles className="size-4" aria-hidden /></span>
            <div>
              <p className="text-sm font-semibold text-navy-950">Abbie Assistant</p>
              <p className="text-xs text-surface-700">Answers about your own account only</p>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div>
                <p className="text-sm text-surface-700">Ask about your bookings, quotes, or balance.</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} type="button" onClick={() => ask(ex)} className="ios-press rounded-full bg-surface-100 px-3 py-1.5 text-xs font-semibold text-navy-950">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "ml-auto bg-navy-950 text-white" : "bg-surface-100 text-navy-950"}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="flex items-center gap-1.5 text-xs text-surface-700"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Thinking…</div>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(query); }} className="flex items-center gap-2 border-t border-surface-200 p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 rounded-full border border-surface-200 px-3.5 py-2 text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
            <button type="submit" disabled={busy || !query.trim()} className="ios-press rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
