// Stop photos: our copy in Supabase Storage when it exists, the original link
// until then. The copy is made by the mirror-photo edge function (see
// supabase/migrations/0004_stop_photo_mirror.sql) and named by content hash,
// so its URL never changes and the service worker can keep it forever.

import { SUPABASE_URL } from "@/lib/supabase";

export const PHOTO_BUCKET = "stop-photos";
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/`;

export function photoUrl(stop: { image_path: string | null; image_url: string | null }) {
  return stop.image_path ? `${STORAGE_PREFIX}${stop.image_path}` : stop.image_url;
}

/** Our own copies send CORS headers, so they can load as non-opaque and cache cleanly. */
export function isStoredPhoto(url: string) {
  return url.startsWith(STORAGE_PREFIX);
}
