"use client";

import { useState } from "react";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

export default function ReviewForm() {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [location, setLocation] = useState("");
  const [quote, setQuote] = useState("");
  const [_gotcha, setGotcha] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, location, quote, rating, _gotcha }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setState("error");
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setError("Network error. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-teal-600" aria-hidden />
        <p className="mt-2 font-semibold text-navy-950">Thank you for sharing your experience!</p>
        <p className="mt-1 text-sm text-surface-700">
          Our team reviews new submissions before they go live on the site.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-surface-200 bg-white p-6">
      <h3 className="font-semibold text-navy-950">Leave a review</h3>
      <p className="mt-1 text-sm text-surface-700">
        Honest feedback only, we never edit what you write, and reviews are moderated before
        they appear publicly.
      </p>

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
        aria-hidden="true"
        value={_gotcha}
        onChange={(e) => setGotcha(e.target.value)}
      />

      <div className="mt-5">
        <span className="text-sm font-semibold text-navy-900">Your rating</span>
        <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(n)}
              className="p-0.5"
            >
              <Star
                className={`size-7 transition-colors ${
                  n <= (hoverRating || rating) ? "fill-warm-500 text-warm-500" : "fill-transparent text-surface-200"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-navy-900">Your name</span>
          <input
            required
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-navy-900">Location (optional)</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Spokane Valley, WA"
            className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-navy-900">Your review</span>
        <textarea
          required
          minLength={10}
          rows={4}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="Tell us how your cleaning went..."
          className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
        />
      </label>

      {state === "error" && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-5 w-full sm:w-auto" disabled={state === "submitting"}>
        {state === "submitting" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Submitting…
          </>
        ) : (
          "Submit review"
        )}
      </Button>
    </form>
  );
}
