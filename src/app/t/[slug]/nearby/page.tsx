import { TripView } from "@/components/TripView";

// A deep link straight to the Nearby tab of the trip page.
export default async function NearbyPage({ params }: PageProps<"/t/[slug]/nearby">) {
  const { slug } = await params;
  return <TripView slug={slug} initialTab="nearby" />;
}
