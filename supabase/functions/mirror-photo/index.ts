// Copies a stop's image_url into the stop-photos bucket and records the copy
// in image_path. Called by the stops trigger (one stop) or by hand with an
// empty body to backfill every stop still missing a copy.
//
// Auth: the caller sends the vault secret in x-mirror-secret. The function has
// verify_jwt off because pg_net calls it without a user session.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "stop-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const BACKFILL_LIMIT = 60;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Stop = { id: string; image_url: string | null; image_path: string | null };
type Result = { id: string; status: "mirrored" | "skipped" | "failed"; detail?: string };

async function mirror(stop: Stop): Promise<Result> {
  const source = stop.image_url;
  if (!source) return { id: stop.id, status: "skipped", detail: "no image_url" };

  const response = await fetch(source, {
    headers: { "User-Agent": "Tripsy photo mirror (github.com/alfredoperez/tripsy)" },
    redirect: "follow",
  });
  if (!response.ok) return { id: stop.id, status: "failed", detail: `HTTP ${response.status}` };

  const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return { id: stop.id, status: "failed", detail: `not an image: ${type || "unknown"}` };

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return { id: stop.id, status: "failed", detail: `too large: ${bytes.byteLength} bytes` };
  }

  // Named by content, so the file never changes and can be cached forever,
  // and two stops with the same photo share one file.
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const path = `${hash}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (uploadError) return { id: stop.id, status: "failed", detail: uploadError.message };

  // Only if image_url is still the one we copied; a newer URL gets its own call.
  const { error: updateError } = await supabase
    .from("stops")
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq("id", stop.id)
    .eq("image_url", source);
  if (updateError) return { id: stop.id, status: "failed", detail: updateError.message };

  return { id: stop.id, status: "mirrored", detail: path };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = req.headers.get("x-mirror-secret") ?? "";
  const { data: ok } = await supabase.rpc("photo_mirror_secret_ok", { token });
  if (!token || ok !== true) return new Response("Forbidden", { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { stop_id?: string };

  let query = supabase.from("stops").select("id, image_url, image_path").not("image_url", "is", null);
  query = body.stop_id
    ? query.eq("id", body.stop_id).is("image_path", null)
    : query.is("image_path", null).limit(BACKFILL_LIMIT);

  const { data: stops, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Result[] = [];
  for (const stop of (stops ?? []) as Stop[]) {
    try {
      results.push(await mirror(stop));
    } catch (err) {
      results.push({ id: stop.id, status: "failed", detail: String(err) });
    }
  }

  return Response.json({ results });
});
