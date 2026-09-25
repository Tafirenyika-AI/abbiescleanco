"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, Check, Send, X, Loader2, Trash2, Link2, Unlink, Image as ImageIcon, AlertTriangle } from "lucide-react";
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
import type { ConnectionListItem } from "@/lib/server/marketingConnections";
import type { PosterSize } from "@/lib/server/aiContent";
import { assembleSlideshowVideo } from "@/lib/client/videoSlideshow";

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

const POSTER_SIZES: { value: PosterSize; label: string }[] = [
  { value: "1024x1536", label: "Portrait (Instagram/Facebook post)" },
  { value: "1024x1024", label: "Square" },
  { value: "1536x1024", label: "Landscape" },
];

const CONNECT_LINKS: { platform: string; label: string; href: string }[] = [
  { platform: "META_FACEBOOK", label: "Connect Facebook + Instagram", href: "/api/admin/marketing/connections/meta/start" },
  { platform: "GOOGLE_ADS", label: "Connect Google Ads", href: "/api/admin/marketing/connections/google-ads/start" },
  { platform: "TIKTOK", label: "Connect TikTok", href: "/api/admin/marketing/connections/tiktok/start" },
];

export default function MarketingManager({
  initialCampaigns,
  initialPosts,
  initialConnections,
}: {
  initialCampaigns: CampaignListItem[];
  initialPosts: PostListItem[];
  initialConnections: ConnectionListItem[];
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"campaigns" | "posts" | "connections">(() => {
    if (typeof window === "undefined") return "campaigns";
    const params = new URLSearchParams(window.location.search);
    return params.get("connected") || params.get("connectError") ? "connections" : "campaigns";
  });
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [posts, setPosts] = useState(initialPosts);
  const [connections, setConnections] = useState(initialConnections);
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
  const [pConnectionId, setPConnectionId] = useState("");
  const [pMediaUrl, setPMediaUrl] = useState<string | null>(null);
  const [pUploading, setPUploading] = useState(false);
  const [pSaving, setPSaving] = useState(false);

  const [pImageMode, setPImageMode] = useState<"upload" | "ai">("upload");
  const [pPosterPrompt, setPPosterPrompt] = useState("");
  const [pPosterSize, setPPosterSize] = useState<PosterSize>("1024x1536");
  const [pGeneratingPoster, setPGeneratingPoster] = useState(false);

  const [pVideoSlides, setPVideoSlides] = useState<string[]>([]);
  const [pVideoOverlay, setPVideoOverlay] = useState("");
  const [pVideoUrl, setPVideoUrl] = useState<string | null>(null);
  const [pAddingSlide, setPAddingSlide] = useState(false);
  const [pGeneratingVideo, setPGeneratingVideo] = useState(false);

  // Reads ?connected=/?connectError= left by the OAuth callback redirects, shows a toast once, then
  // strips them from the URL so a refresh doesn't re-show the same message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const connectError = params.get("connectError");
    if (connected) {
      const count = params.get("count");
      showToast(`Connected${count ? ` ${count} account(s)` : ""} on ${connected}.`, "success");
      refreshConnections();
    } else if (connectError) {
      showToast(connectError, "error");
    }
    if (connected || connectError) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("connectError");
      url.searchParams.delete("count");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function refreshConnections() {
    const res = await fetch("/api/admin/marketing/connections");
    const data = await res.json().catch(() => null);
    if (data?.ok) setConnections(data.connections);
  }

  async function disconnect(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/marketing/connections/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't disconnect", "error");
    showToast("Disconnected.", "success");
    await refreshConnections();
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

  async function uploadMedia(file: File) {
    setPUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    setPUploading(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't upload image", "error");
    setPMediaUrl(data.url);
  }

  async function generatePoster() {
    if (!pPosterPrompt.trim()) return showToast("Describe what the poster should show", "error");
    setPGeneratingPoster(true);
    const res = await fetch("/api/admin/marketing/ai/poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: pPosterPrompt.trim(), size: pPosterSize }),
    });
    const data = await res.json().catch(() => null);
    setPGeneratingPoster(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't generate the poster", "error");
    setPMediaUrl(data.url);
    showToast("Poster generated.", "success");
  }

  async function addUploadedVideoSlide(file: File) {
    setPAddingSlide(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    setPAddingSlide(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't upload image", "error");
    setPVideoSlides((prev) => [...prev, data.url]);
  }

  async function generateVideo() {
    if (pVideoSlides.length === 0) return showToast("Add at least one image first", "error");
    setPGeneratingVideo(true);
    try {
      const blob = await assembleSlideshowVideo(pVideoSlides, pVideoOverlay.trim() || pCaption.trim());
      const form = new FormData();
      form.append("file", blob, "promo.webm");
      const res = await fetch("/api/admin/marketing/ai/video", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!data?.ok) { showToast(data?.error || "Couldn't save the generated video", "error"); return; }
      setPVideoUrl(data.url);
      showToast("Video generated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't generate the video", "error");
    } finally {
      setPGeneratingVideo(false);
    }
  }

  async function createPost() {
    if (!pCaption.trim()) return showToast("Caption is required", "error");
    setPSaving(true);
    const res = await fetch("/api/admin/marketing/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: pCampaignId || null,
        channel: pChannel,
        caption: pCaption.trim(),
        mediaUrl: pMediaUrl,
        videoUrl: pVideoUrl,
        socialConnectionId: pConnectionId || null,
        scheduledFor: null,
      }),
    });
    const data = await res.json().catch(() => null);
    setPSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't create post", "error");
    showToast("Post drafted.", "success");
    setShowPostForm(false);
    setPCaption(""); setPCampaignId(""); setPMediaUrl(null); setPConnectionId("");
    setPPosterPrompt(""); setPImageMode("upload"); setPVideoSlides([]); setPVideoOverlay(""); setPVideoUrl(null);
    await refreshPosts();
  }

  async function deletePost(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/marketing/posts/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't delete draft", "error");
    showToast("Draft deleted.", "success");
    await refreshPosts();
  }

  async function postAction(id: string, action: "approve" | "post" | "cancel" | "publish") {
    setBusyId(id);
    const res = await fetch(`/api/admin/marketing/posts/${id}/${action}`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) {
      showToast(data?.error || "Couldn't update post", "error");
      if (action === "publish") await refreshPosts(); // pick up the real publishError now stored on the post
      return;
    }
    showToast(action === "approve" ? "Approved." : action === "publish" ? "Published." : action === "post" ? "Marked posted." : "Cancelled.", "success");
    await refreshPosts();
  }

  const connectionsForChannel = (channel: MarketingChannel) => connections.filter((c) => c.platform === channel);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-admin-text">Marketing studio</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          Track real campaign spend and ROI using the UTM attribution already captured on your leads, plan content for approval, and connect
          real Facebook/Instagram/Google Ads/TikTok accounts so approved posts can publish automatically instead of by hand.
        </p>
      </div>

      <div className="flex gap-1 rounded-full border border-admin-border bg-admin-card p-1 w-fit">
        <button type="button" onClick={() => setTab("campaigns")} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === "campaigns" ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>Campaigns</button>
        <button type="button" onClick={() => setTab("posts")} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === "posts" ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>Content planner</button>
        <button type="button" onClick={() => setTab("connections")} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === "connections" ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>Connected accounts</button>
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
            <EmptyState icon={Megaphone} title="No posts drafted" description="Draft content here, approve it, then publish automatically (once an account is connected) or mark it posted after publishing it yourself." />
          ) : (
            <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
              <table className="w-full text-sm">
                <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Preview</th>
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-4 py-2.5">Caption</th>
                    <th className="px-4 py-2.5">Account</th>
                    <th className="px-4 py-2.5">Campaign</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Created</th>
                    <th className="px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-t border-admin-border">
                      <td className="px-4 py-2.5">
                        {p.videoUrl ? (
                          <video src={p.videoUrl} controls preload="metadata" className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10" />
                        ) : p.mediaUrl ? (
                          <a href={p.mediaUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.mediaUrl} alt="Post preview" className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10" />
                          </a>
                        ) : (
                          <span className="text-xs text-admin-text-muted/60">No media</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-admin-text-muted">{marketingChannelLabels[p.channel]}</td>
                      <td className="max-w-xs px-4 py-2.5 text-admin-text">
                        <p className="truncate">{p.caption}</p>
                        {p.publishError && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-red-600"><AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden /> {p.publishError}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-admin-text-muted">{p.connectedAccountName ?? <span className="text-admin-text-muted/60">Not connected</span>}</td>
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
                              <button type="button" disabled={busyId === p.id} onClick={() => deletePost(p.id)} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                                <Trash2 className="size-3.5" aria-hidden /> Delete
                              </button>
                            </>
                          )}
                          {p.status === "APPROVED" && (
                            <>
                              {p.socialConnectionId ? (
                                <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "publish")} className="ios-press inline-flex items-center gap-1 rounded-full bg-admin-teal/10 px-2.5 py-1 text-xs font-semibold text-admin-teal-hover hover:bg-admin-teal/20 disabled:opacity-50">
                                  {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />} Publish now
                                </button>
                              ) : (
                                <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "post")} className="ios-press inline-flex items-center gap-1 rounded-full bg-admin-teal/10 px-2.5 py-1 text-xs font-semibold text-admin-teal-hover hover:bg-admin-teal/20 disabled:opacity-50">
                                  {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />} Mark posted
                                </button>
                              )}
                              <button type="button" disabled={busyId === p.id} onClick={() => postAction(p.id, "cancel")} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                                <X className="size-3.5" aria-hidden /> Cancel
                              </button>
                            </>
                          )}
                          {p.status === "POSTED" && p.platformPostId && (
                            <span className="text-xs text-admin-text-muted">Real post id: {p.platformPostId}</span>
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

      {tab === "connections" && (
        <div className="space-y-4">
          <Card>
            <p className="text-sm font-semibold text-admin-text">Connect an account</p>
            <p className="mt-1 text-xs text-admin-text-muted">Each connection needs a developer app registered first (Settings → Integrations). See docs/SOCIAL_ADS_SETUP.md for the exact steps.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONNECT_LINKS.map((link) => (
                <a key={link.platform} href={link.href} className="ios-press inline-flex items-center gap-1.5 rounded-lg bg-admin-navy px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90">
                  <Link2 className="size-4" aria-hidden /> {link.label}
                </a>
              ))}
            </div>
          </Card>

          {connections.length === 0 ? (
            <EmptyState icon={Link2} title="No accounts connected" description="Connect a real account above to enable automatic publishing for its channel." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {connections.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-admin-text">{c.accountName}</p>
                      <p className="mt-0.5 text-xs text-admin-text-muted">{marketingChannelLabels[c.platform]} · id {c.accountId}</p>
                      {c.connectedByName && <p className="mt-1 text-xs text-admin-text-muted">Connected by {c.connectedByName}</p>}
                    </div>
                    <button type="button" disabled={busyId === c.id} onClick={() => disconnect(c.id)} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                      <Unlink className="size-3.5" aria-hidden /> Disconnect
                    </button>
                  </div>
                </Card>
              ))}
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
          <div className="ios-modal-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-admin-text">Draft a post</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Channel</label>
                <select value={pChannel} onChange={(e) => { setPChannel(e.target.value as MarketingChannel); setPConnectionId(""); }} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                  {MARKETING_CHANNELS.map((ch) => <option key={ch} value={ch}>{marketingChannelLabels[ch]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Publish through</label>
                <select value={pConnectionId} onChange={(e) => setPConnectionId(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                  <option value="">Manual (mark posted yourself)</option>
                  {connectionsForChannel(pChannel).map((c) => <option key={c.id} value={c.id}>{c.accountName}</option>)}
                </select>
                {connectionsForChannel(pChannel).length === 0 && <p className="mt-1 text-xs text-admin-text-muted">No connected account for this channel yet -- connect one under Connected accounts to enable auto-publish.</p>}
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
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Image {pChannel === "META_INSTAGRAM" && <span className="text-red-600">(required for Instagram)</span>}</label>

                {pMediaUrl ? (
                  <div className="mt-1 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- uploaded/admin-pasted URLs can be any host */}
                    <img src={pMediaUrl} alt="" className="size-12 rounded-lg object-cover" />
                    <button type="button" onClick={() => setPMediaUrl(null)} className="text-xs font-semibold text-admin-text-muted hover:text-admin-text">Remove</button>
                  </div>
                ) : (
                  <>
                    <div className="mt-1 flex gap-1 rounded-full border border-admin-border bg-admin-bg p-1 w-fit">
                      <button type="button" onClick={() => setPImageMode("upload")} className={`rounded-full px-3 py-1 text-xs font-semibold ${pImageMode === "upload" ? "bg-admin-navy text-white" : "text-admin-text-muted"}`}>Upload your own</button>
                      <button type="button" onClick={() => setPImageMode("ai")} className={`rounded-full px-3 py-1 text-xs font-semibold ${pImageMode === "ai" ? "bg-admin-navy text-white" : "text-admin-text-muted"}`}>Generate with AI</button>
                    </div>

                    {pImageMode === "upload" ? (
                      <label className="ios-press mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg">
                        {pUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />} {pUploading ? "Uploading…" : "Upload image"}
                        <input type="file" accept="image/*" className="hidden" disabled={pUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.target.value = ""; }} />
                      </label>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <textarea value={pPosterPrompt} onChange={(e) => setPPosterPrompt(e.target.value)} rows={2} className="w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder={'Describe the poster: e.g. "Fall deep-clean special, 20% off, sparkling kitchen in the background, bold offer text"'} />
                        <div className="flex items-center gap-2">
                          <select value={pPosterSize} onChange={(e) => setPPosterSize(e.target.value as PosterSize)} className="rounded-lg border border-admin-border px-2 py-1.5 text-xs text-admin-text">
                            {POSTER_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                          <button type="button" disabled={pGeneratingPoster} onClick={generatePoster} className="ios-press inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                            {pGeneratingPoster ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />} {pGeneratingPoster ? "Generating…" : "Generate poster"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-xl border border-admin-border p-3">
                <label className="text-xs font-semibold text-admin-text-muted">AI promo video (optional)</label>
                <p className="mt-0.5 text-xs text-admin-text-muted">Turns a few images into a short pan/zoom slideshow with a text overlay, right in your browser. Automated publishing doesn&apos;t post video yet -- download it or attach it yourself once generated.</p>

                {pVideoSlides.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pVideoSlides.map((url, i) => (
                      <div key={url + i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded/admin-pasted URLs can be any host */}
                        <img src={url} alt="" className="size-14 rounded-lg object-cover" />
                        <button type="button" onClick={() => setPVideoSlides((prev) => prev.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-admin-navy text-white">
                          <X className="size-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {pMediaUrl && !pVideoSlides.includes(pMediaUrl) && (
                    <button type="button" onClick={() => setPVideoSlides((prev) => [...prev, pMediaUrl])} className="ios-press rounded-full border border-admin-border px-2.5 py-1 text-xs font-semibold text-admin-text hover:bg-admin-bg">Add this post&apos;s image</button>
                  )}
                  <label className="ios-press inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-admin-border px-2.5 py-1 text-xs font-semibold text-admin-text hover:bg-admin-bg">
                    {pAddingSlide ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />} Add image
                    <input type="file" accept="image/*" className="hidden" disabled={pAddingSlide} onChange={(e) => { const f = e.target.files?.[0]; if (f) addUploadedVideoSlide(f); e.target.value = ""; }} />
                  </label>
                </div>

                <input value={pVideoOverlay} onChange={(e) => setPVideoOverlay(e.target.value)} className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" placeholder="Overlay text (defaults to the caption above)" />

                {pVideoUrl ? (
                  <div className="mt-2 space-y-1.5">
                    <video src={pVideoUrl} controls className="w-full max-w-[180px] rounded-lg" />
                    <button type="button" onClick={() => setPVideoUrl(null)} className="block text-xs font-semibold text-admin-text-muted hover:text-admin-text">Remove video</button>
                  </div>
                ) : (
                  <button type="button" disabled={pGeneratingVideo || pVideoSlides.length === 0} onClick={generateVideo} className="ios-press mt-2 inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                    {pGeneratingVideo ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />} {pGeneratingVideo ? "Generating video…" : "Generate video"}
                  </button>
                )}
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
