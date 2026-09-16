"use client";

import { useEffect, useState } from "react";
import { X, Share, PlusSquare, Download } from "lucide-react";

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

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
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
      setMode("android");
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

  return (
    <div
      role="dialog"
      aria-label="Add to home screen"
      className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-surface-200 bg-white p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:w-80 md:bottom-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-surface-700 hover:bg-surface-100"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
          <Download className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-navy-950">Add Abbie&apos;s Clean Method to your Home Screen</p>
          {mode === "android" ? (
            <p className="mt-1 text-xs text-surface-700">Get one-tap access next time — no app store needed.</p>
          ) : (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-surface-700">
              Tap <Share className="inline size-3.5" aria-hidden /> Share, then{" "}
              <PlusSquare className="inline size-3.5" aria-hidden /> &ldquo;Add to Home Screen.&rdquo;
            </p>
          )}
        </div>
      </div>

      {mode === "android" && (
        <button
          type="button"
          onClick={install}
          className="mt-3 w-full rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-teal-400"
        >
          Add to Home Screen
        </button>
      )}
    </div>
  );
}
