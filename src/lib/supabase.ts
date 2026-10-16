import { createClient } from "@supabase/supabase-js";

// Both values are public by design: the publishable key ships in the browser
// bundle and row level security decides what a signed-in member can read.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mhafbfmjcokxzydraplj.supabase.co";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_Z5s9xFMW0Tvhrhii0KBmAg_kOSFJXOi";

export const supabase = createClient(url, publishableKey);
