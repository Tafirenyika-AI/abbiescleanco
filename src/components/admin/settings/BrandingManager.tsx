"use client";

import { useState } from "react";
import Card from "@/components/admin/ui/Card";
import { useToast } from "@/components/admin/ui/Toast";
import ImageUploadField from "@/components/admin/content/ImageUploadField";
import type { BrandingSettings } from "@/lib/server/siteSettings";

export default function BrandingManager({ initialBranding }: { initialBranding: BrandingSettings }) {
  const { showToast } = useToast();
  const [logoUrl, setLogoUrl] = useState(initialBranding.logoUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function save(nextLogoUrl: string) {
    setSaving(true);
    const res = await fetch("/api/admin/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: nextLogoUrl || null }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Couldn't save logo", "error");
      return;
    }
    showToast("Logo updated", "success");
  }

  return (
    <Card>
      <h2 className="font-semibold text-admin-text">Logo</h2>
      <p className="mt-1 text-sm text-admin-text-muted">
        Shown in the site header and footer. Leave blank to use the default logo shipped with the site.
      </p>
      <div className="mt-3 max-w-sm">
        <ImageUploadField
          label="Site logo"
          value={logoUrl}
          onChange={setLogoUrl}
          onCommit={save}
        />
      </div>
      {saving && <p className="mt-2 text-xs text-admin-text-muted">Saving…</p>}
    </Card>
  );
}
