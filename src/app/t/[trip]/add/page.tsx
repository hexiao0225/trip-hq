import { notFound } from "next/navigation";

import { Nav } from "@/components/nav";
import { SegmentForm } from "@/components/segment-form";
import { SetupNotice } from "@/components/setup-notice";
import { getNavData } from "@/lib/nav";
import { getTripContext, toFormTrip, type TripContext } from "@/lib/trips";

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function AddPage({
  params,
}: {
  params: Promise<{ trip: string }>;
}) {
  const { trip: slug } = await params;

  let loaded: {
    context: TripContext | null;
    nav: Awaited<ReturnType<typeof getNavData>>;
  };
  try {
    const [context, nav] = await Promise.all([
      getTripContext(slug),
      getNavData(slug),
    ]);
    loaded = { context, nav };
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const { context, nav } = loaded;
  if (!context) notFound();

  return (
    <>
      <Nav trip={nav.current} trips={nav.trips} pendingCount={nav.pendingCount} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">
          Add to {context.trip.name}
        </h1>
        <SegmentForm trip={toFormTrip(context)} />
      </main>
    </>
  );
}
