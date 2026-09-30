"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, CheckCircle2, XCircle, Clock, PlayCircle, StopCircle } from "lucide-react";
import TrackChat from "@/components/track/TrackChat";
import LoadingSpinner from "@/components/LoadingSpinner";

interface JobInfo {
  address: string;
  serviceName: string;
  scheduledStart: string | null;
  bookingStatus: string;
  actualStart: string | null;
  actualEnd: string | null;
}

// GPS "share my location" only makes sense before the job has actually started -- once clocked
// in, the customer already knows the cleaner arrived.
const GPS_SHARE_STATUSES = new Set(["CONFIRMED", "SCHEDULED", "ON_THE_WAY"]);
const CAN_CLOCK_IN_STATUSES = new Set(["CONFIRMED", "SCHEDULED", "ON_THE_WAY"]);

const MIN_POST_INTERVAL_MS = 6000; // client-side throttle -- watchPosition can fire far more often than we need to send

/**
 * The cleaner's side of live tracking: no login, just this one link for this one job. Tapping
 * "Share my location" starts a real browser geolocation watch that posts positions to the
 * server; nothing is sent before the cleaner explicitly taps the button, and "Stop sharing" is
 * always one tap away.
 */
export default function TrackingShareClient({ token }: { token: string }) {
  const [job, setJob] = useState<JobInfo | null | "not_found">(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [clockError, setClockError] = useState("");
  const [clocking, setClocking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPostRef = useRef(0);

  function refreshJob() {
    fetch(`/api/track/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setJob(data.ok ? data : "not_found"))
      .catch(() => setJob("not_found"));
  }

  useEffect(refreshJob, [token]);

  async function clockIn() {
    setClocking(true);
    setClockError("");
    const res = await fetch(`/api/track/${token}/clock-in`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setClocking(false);
    if (!data?.ok) {
      setClockError(data?.error || "Couldn't clock in");
      return;
    }
    refreshJob();
  }

  async function clockOut() {
    setClocking(true);
    setClockError("");
    const res = await fetch(`/api/track/${token}/clock-out`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setClocking(false);
    if (!data?.ok) {
      setClockError(data?.error || "Couldn't clock out");
      return;
    }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setSharing(false);
    refreshJob();
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  function startSharing() {
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location sharing.");
      return;
    }
    setError("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPostRef.current < MIN_POST_INTERVAL_MS) return;
        lastPostRef.current = now;
        fetch(`/api/track/${token}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyMeters: pos.coords.accuracy }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok) setLastSentAt(new Date());
            else setError(data.error || "Couldn't send your location");
          })
          .catch(() => setError("Couldn't send your location -- check your connection"));
      },
      () => setError("Location access was denied. Enable location for this site in your phone's settings to share it."),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    setSharing(true);
  }

  function stopSharing() {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setSharing(false);
    fetch(`/api/track/${token}/stop`, { method: "POST" }).catch(() => {});
  }

  if (job === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoadingSpinner size="md" />
      </div>
    );
  }
  if (job === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <XCircle className="size-8 text-white/50" aria-hidden />
        <p className="text-sm text-white/70">This link isn&apos;t valid.</p>
      </div>
    );
  }
  if (job.bookingStatus === "COMPLETED" || job.bookingStatus === "CANCELLED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <CheckCircle2 className="size-8 text-white/50" aria-hidden />
        <p className="text-sm text-white/70">
          {job.bookingStatus === "COMPLETED" ? "This job is already marked done. Thanks!" : "This job was cancelled."}
        </p>
      </div>
    );
  }

  const inProgress = job.bookingStatus === "IN_PROGRESS";
  const canClockIn = CAN_CLOCK_IN_STATUSES.has(job.bookingStatus);
  const showGpsShare = GPS_SHARE_STATUSES.has(job.bookingStatus);

  return (
    <div className="flex min-h-screen flex-col justify-between gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">{job.serviceName}</h1>
        <p className="mt-1 text-sm text-white/70">{job.address}</p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 p-6 text-center">
        {inProgress ? (
          <>
            <Clock className="size-10 text-teal-300" aria-hidden />
            <p className="text-sm font-semibold text-teal-300">Clocked in{job.actualStart ? ` at ${new Date(job.actualStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</p>
            <p className="text-xs text-white/60">Tap below once you&apos;re done with this job.</p>
          </>
        ) : canClockIn ? (
          <>
            <Clock className="size-10 text-white/40" aria-hidden />
            <p className="text-sm text-white/70">Tap below when you actually start this job.</p>
          </>
        ) : null}
        {clockError && <p className="max-w-xs text-xs text-red-400">{clockError}</p>}
        {inProgress ? (
          <button
            type="button"
            onClick={clockOut}
            disabled={clocking}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-navy-950 disabled:opacity-60"
          >
            <StopCircle className="size-4" aria-hidden /> Clock out
          </button>
        ) : canClockIn ? (
          <button
            type="button"
            onClick={clockIn}
            disabled={clocking}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-full bg-teal-500 px-4 py-3 text-sm font-semibold text-navy-950 disabled:opacity-60"
          >
            <PlayCircle className="size-4" aria-hidden /> Clock in
          </button>
        ) : null}
      </div>

      {showGpsShare && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          {sharing ? (
            <>
              <span className="relative flex size-16 items-center justify-center rounded-full bg-teal-500/20">
                <span className="absolute inline-flex size-16 animate-ping rounded-full bg-teal-500/30" />
                <MapPin className="size-7 text-teal-300" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-teal-300">Sharing your location</p>
              {lastSentAt && <p className="text-xs text-white/50">Last sent {lastSentAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>}
            </>
          ) : (
            <>
              <MapPin className="size-10 text-white/40" aria-hidden />
              <p className="text-sm text-white/70">Or share your location so the customer can see you&apos;re on the way.</p>
            </>
          )}
          {error && <p className="max-w-xs text-xs text-red-400">{error}</p>}
          {sharing ? (
            <button type="button" onClick={stopSharing} className="ios-press w-full rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white">
              Stop sharing
            </button>
          ) : (
            <button type="button" onClick={startSharing} className="ios-press flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white">
              <CheckCircle2 className="size-4" aria-hidden /> Share my location
            </button>
          )}
        </div>
      )}

      <TrackChat token={token} />
    </div>
  );
}
