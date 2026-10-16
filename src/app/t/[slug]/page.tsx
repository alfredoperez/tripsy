import { TripView } from "@/components/TripView";

export default async function TripPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  return <TripView slug={slug} />;
}
