import TrackingShareClient from "@/components/track/TrackingShareClient";

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TrackingShareClient token={token} />;
}
