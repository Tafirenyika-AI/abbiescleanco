"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/client/googleMapsLoader";

const POLL_MS = 8000;

/**
 * The real Uber/DoorDash-style piece: polls the customer's own booking for the cleaner's latest
 * shared position and smoothly moves a marker to it. No fabricated movement -- if nothing has
 * come in yet, this shows an honest "waiting for live location" state instead of a fake dot. A
 * single failed poll never stops the loop; it just quietly retries next cycle.
 */
export default function LiveTrackingMap({ bookingId }: { bookingId: string }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [state, setState] = useState<"loading" | "waiting" | "live">("loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/account/bookings/${bookingId}/location`);
        const data = await res.json();
        if (cancelled) return;

        if (data.ok && data.active && data.lat != null && data.lng != null && data.mapsApiKey) {
          const maps = await loadGoogleMaps(data.mapsApiKey);
          if (cancelled || !mapDivRef.current) return;
          const position = new maps.LatLng(data.lat, data.lng);
          if (!mapRef.current) {
            mapRef.current = new maps.Map(mapDivRef.current, { center: position, zoom: 15, disableDefaultUI: true, zoomControl: true });
          }
          if (!markerRef.current) {
            markerRef.current = new maps.Marker({ position, map: mapRef.current, title: "Your cleaner" });
          } else {
            markerRef.current.setPosition(position);
          }
          mapRef.current.panTo(position);
          setUpdatedAt(data.updatedAt);
          setState("live");
        } else if (data.ok) {
          setState((s) => (s === "live" ? s : "waiting"));
        }
      } catch {
        // Transient fetch/map-load hiccup -- keep whatever's currently shown and retry silently.
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

  return (
    <div className="mt-3">
      {state === "waiting" && <p className="mb-2 text-xs text-surface-700">Waiting for your cleaner to start sharing their location…</p>}
      <div ref={mapDivRef} className={`h-56 w-full rounded-xl border border-surface-200 ${state !== "live" ? "hidden" : ""}`} />
      {state === "live" && updatedAt && (
        <p className="mt-1.5 text-xs text-surface-700">Updated {new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
      )}
    </div>
  );
}
