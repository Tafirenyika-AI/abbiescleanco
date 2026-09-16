"use client";

import { useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import type { AdminReview } from "@/lib/server/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-4 ${n <= rating ? "fill-amber-500 text-amber-500" : "fill-transparent text-slate-300"}`} aria-hidden />
      ))}
    </div>
  );
}

function ReviewRow({ review }: { review: AdminReview }) {
  const [isPublished, setIsPublished] = useState(review.isPublished);
  const [isFeatured, setIsFeatured] = useState(review.isFeatured);
  const [saving, setSaving] = useState(false);

  async function update(data: { isPublished?: boolean; isFeatured?: boolean }) {
    setSaving(true);
    if (data.isPublished !== undefined) setIsPublished(data.isPublished);
    if (data.isFeatured !== undefined) setIsFeatured(data.isFeatured);
    await fetch(`/api/admin/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{review.authorName}</p>
            {review.location && <span className="text-sm text-slate-500">· {review.location}</span>}
          </div>
          <div className="mt-1"><Stars rating={review.rating} /></div>
        </div>
        <p className="shrink-0 text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p>
      </div>
      <p className="mt-3 text-sm text-slate-700">&ldquo;{review.quote}&rdquo;</p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isPublished} onChange={(e) => update({ isPublished: e.target.checked })} />
          Published
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isFeatured} onChange={(e) => update({ isFeatured: e.target.checked })} disabled={!isPublished} />
          Featured on homepage
        </label>
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
        {!saving && <CheckCircle2 className="size-4 text-teal-500 opacity-0" aria-hidden />}
      </div>
    </div>
  );
}

export default function ReviewsManager({ reviews }: { reviews: AdminReview[] }) {
  const pending = reviews.filter((r) => !r.isPublished);
  const published = reviews.filter((r) => r.isPublished);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Awaiting review ({pending.length})</h2>
        <div className="mt-4 space-y-4">
          {pending.length === 0 && <p className="text-sm text-slate-500">Nothing pending.</p>}
          {pending.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Published ({published.length})</h2>
        <div className="mt-4 space-y-4">
          {published.length === 0 && <p className="text-sm text-slate-500">Nothing published yet.</p>}
          {published.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </div>
      </section>
    </div>
  );
}
