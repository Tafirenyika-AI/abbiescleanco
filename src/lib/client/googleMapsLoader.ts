/**
 * Loads the Google Maps JavaScript API once per page and caches the promise, so multiple
 * components mounting/unmounting (e.g. re-opening the account detail sheet) don't inject the
 * script tag twice. No wrapper library -- this is the only place in the app that needs the JS
 * SDK (everywhere else uses the key-only Embed API), so a small vanilla loader is simpler than a
 * new dependency.
 */

declare global {
  interface Window {
    google?: typeof google;
  }
}

let loadPromise: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps failed to initialize"));
    };
    script.onerror = () => reject(new Error("Could not load Google Maps"));
    document.head.appendChild(script);
  });
  return loadPromise;
}
