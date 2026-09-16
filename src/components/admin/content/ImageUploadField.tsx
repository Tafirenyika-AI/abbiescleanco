"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

export default function ImageUploadField({
  value,
  onChange,
  onCommit,
  label = "Image",
}: {
  value: string;
  onChange: (url: string) => void;
  /** Fires when a value should be persisted: after a successful upload, or when the text field loses focus. */
  onCommit?: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Upload failed");
        return;
      }
      onChange(json.url);
      onCommit?.(json.url);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">{label}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onCommit?.(value)}
          placeholder="/images/example.jpg"
          className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm font-mono"
        />
      </label>
      <div className="mt-1.5 flex items-center gap-3">
        {value && (
          // Admin-pasted or uploaded URLs can be any host — plain <img> avoids
          // requiring every possible source in next.config's remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-12 shrink-0 rounded-lg border border-admin-border object-cover" />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
          {uploading ? "Uploading…" : "Upload image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
