"use client";

import { useEffect, useState } from "react";
import { X, Share, PlusSquare, Download, Monitor, Smartphone } from "lucide-react";

const DISMISS_KEY = "acm-install-prompt-dismissed-at";
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's legacy standalone flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** True phone/tablet, as opposed to desktop/laptop Chrome or Edge (which also fire beforeinstallprompt but aren't "mobile"). */
function isMobileDevice(): boolean {
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile !== undefined) return uaData.mobile;
  return /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"ios" | "mobile" | "desktop" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios|chrome|android/i.test(window.navigator.userAgent);

    if (isIOS && isSafari) {
      // No beforeinstallprompt on iOS — show manual instructions after a
      // short delay so it doesn't compete with the page's first paint.
      const timer = setTimeout(() => {
        setMode("ios");
        setVisible(true);
      }, 4000);
      return () => clearTimeout(timer);
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode(isMobileDevice() ? "mobile" : "desktop");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable (private mode etc.) — fine, just won't persist the dismissal
    }
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible || !mode) return null;

  const title = mode === "desktop" ? "Install Abbie's Clean Method" : "Add Abbie's Clean Method to your Home Screen";
  const Icon = mode === "desktop" ? Monitor : Smartphone;

  return (
    <div
      role="dialog"
      aria-label={mode === "desktop" ? "Install app" : "Add to home screen"}
      className="ios-glass ios-sheet-in fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 rounded-[28px] p-5 shadow-[0_12px_48px_rgba(11,31,51,0.22)] ring-1 ring-black/[0.06] sm:inset-x-auto sm:right-4 sm:w-96 md:bottom-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="ios-press absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-black/[0.06] text-navy-800/70"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-teal-100 text-teal-600">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-navy-950">{title}</p>
          {mode === "desktop" ? (
            <p className="mt-1 text-xs text-surface-700">Opens in its own window, pinned to your taskbar/dock, no browser tabs, no app store.</p>
          ) : mode === "mobile" ? (
            <p className="mt-1 text-xs text-surface-700">Get one-tap access next time, no app store needed.</p>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-surface-700">
              Tap <Share className="inline size-3.5" aria-hidden /> Share, then{" "}
              <PlusSquare className="inline size-3.5" aria-hidden /> &ldquo;Add to Home Screen.&rdquo;
            </p>
          )}
        </div>
      </div>

      {(mode === "mobile" || mode === "desktop") && (
        <button
          type="button"
          onClick={install}
          className="ios-press mt-4 w-full rounded-full bg-teal-500 px-4 py-3 text-[15px] font-semibold text-navy-950 shadow-[0_6px_16px_rgba(20,179,163,0.3)]"
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            <Download className="size-4" aria-hidden />
            {mode === "desktop" ? "Install" : "Add to Home Screen"}
          </span>
        </button>
      )}
    </div>
  );
}
