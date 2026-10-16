import { NearbyView } from "@/components/Nearby";

export default async function NearbyPage({ params }: PageProps<"/t/[slug]/nearby">) {
  const { slug } = await params;
  return <NearbyView slug={slug} />;
}
