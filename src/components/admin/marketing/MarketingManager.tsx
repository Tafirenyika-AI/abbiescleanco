"use client";

import { useState } from "react";
import { Megaphone, Plus, Check, Send, X, Loader2, Trash2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import Badge from "@/components/admin/ui/Badge";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate } from "@/lib/adminDate";
import {
  marketingChannelLabels,
  MARKETING_CHANNELS,
  type CampaignListItem,
  type PostListItem,
  type MarketingChannel,
} from "@/lib/server/marketingStore";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function pct(ratio: number) {
  return `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(0)}%`;
}

const campaignStatusTone: Record<string, "neutral" | "success" | "warning" | "info"> = {
  DRAFT: "neutral", ACTIVE: "success", PAUSED: "warning", COMPLETED: "info",
};

const postStatusTone: Record<string, "neutral" | "success" | "warning" | "info"> = {
  DRAFT: "neutral", APPROVED: "info", POSTED: "success", CANCELLED: "warning",
};

export default function MarketingManager({ initialCampaigns, initialPosts }: { initialCampaigns: CampaignListItem[]; initialPosts: PostListItem[] }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"campaigns" | "posts">("campaigns");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [posts, setPosts] = useState(initialPosts);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [cName, setCName] = useState("");
  const [cChannel, setCChannel] = useState<MarketingChannel>("GOOGLE_ADS");
  const [cUtm, setCUtm] = useState("");
  const [cSpend, setCSpend] = useState("");
  const [cSaving, setCSaving] = useState(false);

  const [showPostForm, setShowPostForm] = useState(false);
  const [pCampaignId, setPCampaignId] = useState("");
  const [pChannel, setPChannel] = useState<MarketingChannel>("META_INSTAGRAM");
  const [pCaption, setPCaption] = useState("");
  const [pSaving, setPSaving] = useState(false);

  async function refreshCampaigns() {
    const res = await fetch("/api/admin/marketing/campaigns");
    const data = await res.json().catch(() => null);
    if (data?.ok) setCampaigns(data.campaigns);
  }

  async function refreshPosts() {
    const res = await fetch("/api/admin/marketing/posts");
    const data = await res.json().catch(() => null);
    if (data?.ok) setPosts(data.posts);
  }

  async function createCampaign() {
    if (!cName.trim()) return showToast("Name is required", "error");
    setCSaving(true);
    const res = await fetch("/api/admin/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cName.trim(),
        channel: cChannel,
        utmCampaign: cUtm.trim() || null,
        spend: Math.round(parseFloat(cSpend || "0") * 100) || 0,
        startDate: null,
        endDate: null,
        notes: null,
      }),
    });
    const data = await res.json().catch(() => null);
    setCSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't create campaign", "error");
    showToast("Campaign created.", "success");
    setShowCampaignForm(false);
    setCName(""); setCUtm(""); setCSpend("");
    await refreshCampaigns();
  }

  async function deleteCampaign(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/marketing/campaigns/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't delete campaign", "error");
    showToast("Campaign deleted.", "success");
    await refreshCampaigns();
  }

  async function createPost() {
    if (!pCaption.trim()) return showToast("Caption is required", "error");
    setPSaving(true);
    const res = await fetch("/api/admin/marketing/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: pCampaignId || null, channel: pChannel, caption: pCaption.trim(), scheduledFor: null }),
    });
    const data = await res.json().catch(() => null);
    setPSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't create post", "error");
    showToast("Post drafted.", "success");
    setShowPostForm(false);
    setPCaption(""); setPCampaignId("");
    await refreshPosts();
  }

  async function postAction(id: string, action: "approve" | "post" | "cancel") {
    setBusyId(id);
    const res = await fetch(`/api/admin/marketing/posts/${id}/${action}`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't update post", "error");
    showToast(action === "approve" ? "Approved." : action === "post" ? "Marked posted." : "Cancelled.", "success");
    await refreshPosts();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-admin-text">Marketing studio</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          Track real campaign spend and ROI using the UTM attribution already captured on your leads, and plan content for approval.
          Publishing to Google Ads, Google Business Profile, Meta, or TikTok directly isn&apos;t available yet -- that needs a developer app registration and connected account per platform. Posting stays a manual step: draft here, approve it, publish it yourself on the real platform, then mark it posted.
        </p>
      </div>

      <div className="flex gap-1 rounded-full border border-admin-border bg-admin-card p-1 w-fit">
        <button type="button" onClick={() => setTab("campaigns")} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === "campaigns" ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>Campaigns</button>
        <button type="button" onClick={() => setTab("posts")} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === "posts" ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>Content planner</button>
      </div>

      {tab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowCampaignForm(true)} className="ios-press inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
              <Plus className="size-4" aria-hidden /> New campaign
            </button>
          </div>

          {campaigns.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns yet" description="Add a campaign and give it the same UTM campaign value your ads/links use, and its real leads, customers, and revenue will show up automatically." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {campaigns.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-admin-text">{c.name}</p>
                      <p className="mt-0.5 text-xs text-admin-text-muted">{marketingChannelLabels[c.channel]}{c.utmCampaign ? ` · utm_campaign=${c.utmCampaign}` : ""}</p>
                    </div>
                    <Badge tone={campaignStatusTone[c.status]}>{c.status}</Badge>
                  </div>

                  {!c.utmCampaign ? (
                    <p className="mt-3 text-xs text-admin-text-muted">No UTM campaign value set -- add one to attribute real leads/revenue here.</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-admin-text-muted">Leads</p><p className="font-semibold text-admin-text">{c.leadsGenerated}</p></div>
                      <div><p className="text-admin-text-muted">Customers</p><p className="font-semibold text-admin-text">{c.customersAcquired}</p></div>
                      <div><p className="text-admin-text-muted">Revenue</p><p className="font-semibold text-admin-text">{money(c.revenueGenerated)}</p></div>
                      <div><p className="text-admin-text-muted">Spend</p><p className="font-semibold text-admin-text">{money(c.spend)}</p></div>
                      <div><p className="text-admin-text-muted">Cost / lead</p><p className="font-semibold text-admin-text">{c.costPerLead !== null ? money(c.costPerLead) : "—"}</p></div>
                      <div><p className="text-admin-text-muted">ROI</p><p className={`font-semibold ${c.roi !== null && c.roi >= 0 ? "text-admin-success" : "text-admin-text"}`}>{c.roi !== null ? pct(c.roi) : "—"}</p></div>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button type="button" disabled={busyId === c.id} onClick={() => deleteCampaign(c.id)} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                      <Trash2 className="size-3.5" aria-hidden /> Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "posts" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowPostForm(true)} className="ios-press inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
              <Plus className="size-4" aria-hidden /> Draft a post
            </button>
          </div>

          {posts.length === 0 ? (
            <EmptyState icon={Megaphone} title="No posts drafted" description="Draft content here, approve it, then publish it yourself on the real platform and mark it posted." />
          ) : (
            <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
              <table className="w-full text-sm">
                <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-4 py-2.5">Caption</th>
                    <th className="px-4 py-2.5">Campaign</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Created</th>
                    <th className="px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-t border-admin-border">
                      <td className="px-4 py-2.5 text-admin-text-muted">{marketingChannelLabels[p.channel]}</td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-admin-text">{p.caption}</td>
                      <td className="px-4 py-2.5 text-admin-text-muted">{p.campaignName ?? "—"}</td>
                      <td className="px-4 py-2.5"><Badge tone={postStatusTone[p.status]}>{p.status}</Badge></td>
                      <td className="px-4 py-2.5 text-admin-text-muted">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          {p.status === "DRAFT" && (
                            <>
                              <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "approve")} className="ios-press inline-flex items-center gap-1 rounded-full bg-admin-success/10 px-2.5 py-1 text-xs font-semibold text-admin-success hover:bg-admin-success/20 disabled:opacity-50">
                                <Check className="size-3.5" aria-hidden /> Approve
                              </button>
                              <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "cancel")} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                                <X className="size-3.5" aria-hidden /> Cancel
                              </button>
                            </>
                          )}
                          {p.status === "APPROVED" && (
                            <>
                              <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "post")} className="ios-press inline-flex items-center gap-1 rounded-full bg-admin-teal/10 px-2.5 py-1 text-xs font-semibold text-admin-teal-hover hover:bg-admin-teal/20 disabled:opacity-50">
                                {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />} Mark posted
                              </button>
                              <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "cancel")} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                                <X className="size-3.5" aria-hidden /> Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCampaignForm && (
        <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setShowCampaignForm(false)}>
          <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-admin-text">New campaign</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Name</label>
                <input value={cName} onChange={(e) => setCName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="Fall deep-clean promo" />
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Channel</label>
                <select value={cChannel} onChange={(e) => setCChannel(e.target.value as MarketingChannel)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                  {MARKETING_CHANNELS.map((ch) => <option key={ch} value={ch}>{marketingChannelLabels[ch]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">UTM campaign value</label>
                <input value={cUtm} onChange={(e) => setCUtm(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="fall-deep-clean-2026 (must match the ?utm_campaign= your ads/links use)" />
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Spend so far ($)</label>
                <input value={cSpend} onChange={(e) => setCSpend(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="0.00" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCampaignForm(false)} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
              <button type="button" disabled={cSaving} onClick={createCampaign} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {cSaving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPostForm && (
        <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setShowPostForm(false)}>
          <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-admin-text">Draft a post</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Channel</label>
                <select value={pChannel} onChange={(e) => setPChannel(e.target.value as MarketingChannel)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                  {MARKETING_CHANNELS.map((ch) => <option key={ch} value={ch}>{marketingChannelLabels[ch]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Campaign (optional)</label>
                <select value={pCampaignId} onChange={(e) => setPCampaignId(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                  <option value="">None</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Caption</label>
                <textarea value={pCaption} onChange={(e) => setPCaption(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="Write the post content here…" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowPostForm(false)} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
              <button type="button" disabled={pSaving} onClick={createPost} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {pSaving ? "Saving…" : "Save draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
