import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/setup-notice";
import { defaultTrip, getTrips } from "@/lib/trips";
import type { Trip } from "@/lib/db/schema";

/**
 * The root has no timeline of its own any more — it hands off to whichever
 * trip is happening now, or next. With no trips at all, that's the trip list,
 * which is where one gets created.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let trips: Trip[];
  try {
    trips = await getTrips();
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const trip = defaultTrip(trips);
  redirect(trip ? `/t/${trip.slug}` : "/trips");
}
