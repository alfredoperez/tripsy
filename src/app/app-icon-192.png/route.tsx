import { appIcon } from "@/lib/appIcon";

// Manifest icon, built at build time.
export function GET() {
  return appIcon(192, { rounded: true });
}
