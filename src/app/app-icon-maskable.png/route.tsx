import { appIcon } from "@/lib/appIcon";

// Maskable: full bleed, the pin inside the safe zone so a circle crop keeps it whole.
export function GET() {
  return appIcon(512, { scale: 0.46 });
}
