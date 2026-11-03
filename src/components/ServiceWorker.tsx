"use client";

import { useEffect } from "react";

/**
 * Asks the service worker to keep a copy of this page for offline use. Called
 * by the pages themselves, so a page reached by an in-app link (which loads no
 * HTML) is saved too.
 */
export function rememberPage(path: string) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) =>
      registration.active?.postMessage({ type: "tripsy:remember", path, assets: loadedBuildFiles() }),
    )
    .catch(() => {});
}

/**
 * The CSS and JS this page already loaded. On a first visit they arrive before
 * the service worker takes control, so it never sees them; without them the
 * page would come back unstyled offline.
 */
function loadedBuildFiles() {
  const urls = new Set<string>();
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) urls.add(link.href);
  for (const entry of performance.getEntriesByType("resource")) urls.add(entry.name);
  return [...urls].filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === location.origin && parsed.pathname.startsWith("/_next/static/");
    } catch {
      return false;
    }
  });
}

/**
 * Registers /sw.js, which keeps photos and the app shell on the phone (see
 * public/sw.js). Production only, so `next dev` never serves stale bundles.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // No service worker: the app still works, it just needs the network.
    });
  }, []);
  return null;
}
