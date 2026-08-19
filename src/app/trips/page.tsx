import Link from "next/link";

import { archiveTrip } from "@/app/trip-actions";
import { Nav } from "@/components/nav";
import { SetupNotice } from "@/components/setup-notice";
import { accent } from "@/lib/accents";
import { companionById } from "@/lib/config";
import type { Trip } from "@/lib/db/schema";
import { getNavData, tripWhen } from "@/lib/nav";
import {
  getPendingCounts,
  getSegmentCounts,
  getTrips,
  tripPhase,
  type TripPhase,
} from "@/lib/trips";
import { formatDateRange } from "@/lib/time";

const PHASE_LABEL: Record<TripPhase, string> = {
  current: "Happening now",
  upcoming: "Coming up",
  planning: "Being planned",
  past: "Been and gone",
};

function TripCard({
  trip,
  bookings,
  pending,
}: {
  trip: Trip;
  bookings: number;
  pending: number;
}) {
  const who = trip.travelers
    .map((id) => companionById(id)?.name)
    .filter(Boolean)
    .join(" & ");

  return (
    <div
      className={`rounded-xl border border-edge border-l-4 bg-surface p-4 ${
        accent(trip.accent).borderClass
      } ${trip.archivedAt ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg leading-none">
          {trip.emoji ?? "🧭"}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="font-medium">
            <Link
              href={`/t/${trip.slug}`}
              className="underline-offset-2 hover:underline"
            >
              {trip.name}
            </Link>
          </h2>

          {trip.destination && (
            <p className="mt-0.5 text-sm text-muted">{trip.destination}</p>
          )}

          <p className="mt-1.5 font-mono text-xs text-foreground/80">
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>

          <p className="mt-1 text-xs text-muted">
            {tripWhen(trip)}
            {who && ` · ${who}`}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`/t/${trip.slug}`}
              className="btn-secondary min-h-10 px-3 text-xs"
            >
              {bookings === 1 ? "1 booking" : `${bookings} bookings`}
            </Link>

            {pending > 0 && (
              <Link
                href={`/t/${trip.slug}/inbox`}
                className="btn-secondary min-h-10 px-3 text-xs"
              >
                {pending} to review
              </Link>
            )}

            <Link
              href={`/t/${trip.slug}/settings`}
              className="btn-secondary min-h-10 px-3 text-xs"
            >
              Settings
            </Link>

            <form action={archiveTrip}>
              <input type="hidden" name="id" value={trip.id} />
              <input
                type="hidden"
                name="archived"
                value={trip.archivedAt ? "false" : "true"}
              />
              <button
                type="submit"
                className="btn-secondary min-h-10 px-3 text-xs"
              >
                {trip.archivedAt ? "Unarchive" : "Archive"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  let trips: Trip[];
  let bookings: Map<string, number>;
  let pending: Awaited<ReturnType<typeof getPendingCounts>>;
  let nav: Awaited<ReturnType<typeof getNavData>>;
  try {
    [trips, bookings, pending, nav] = await Promise.all([
      getTrips({ includeArchived: true }),
      getSegmentCounts(),
      getPendingCounts(),
      getNavData(),
    ]);
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const active = trips.filter((trip) => !trip.archivedAt);
  const archived = trips.filter((trip) => trip.archivedAt);

  // Group by phase so the list reads as "now, soon, someday" rather than as
  // one undifferentiated pile once there are a few years of them.
  const phases: TripPhase[] = ["current", "upcoming", "planning", "past"];
  const grouped = phases
    .map((phase) => ({
      phase,
      trips: active.filter((trip) => tripPhase(trip) === phase),
    }))
    .filter((group) => group.trips.length > 0);

  return (
    <>
      <Nav trip={null} trips={nav.trips} pendingCount={0} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Trips</h1>
            <p className="mt-1 text-sm text-muted">
              Every trip, with what&apos;s booked and what&apos;s waiting.
            </p>
          </div>
          <Link href="/trips/new" className="btn-primary min-h-10">
            New trip
          </Link>
        </div>

        {pending.unassigned > 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            {pending.unassigned} forwarded booking
            {pending.unassigned === 1 ? "" : "s"} couldn&apos;t be matched to a
            trip. Open any trip&apos;s <strong>Review</strong> to file{" "}
            {pending.unassigned === 1 ? "it" : "them"}.
          </p>
        )}

        {trips.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-edge px-4 py-10 text-center">
            <p className="font-medium">No trips yet</p>
            <p className="mt-1 text-sm text-muted">
              Start with where you&apos;re going and roughly when. Everything
              else — legs, bookings, forwarded email — hangs off that.
            </p>
            <Link href="/trips/new" className="btn-primary mt-4">
              Plan the first trip
            </Link>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.phase} className="mt-8 first:mt-6">
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                {PHASE_LABEL[group.phase]}
              </h2>
              <div className="mt-3 space-y-2">
                {group.trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    bookings={bookings.get(trip.id) ?? 0}
                    pending={pending.byTrip.get(trip.id) ?? 0}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {archived.length > 0 && (
          <details className="mt-10">
            <summary className="cursor-pointer text-sm font-semibold tracking-wide uppercase select-none">
              Archived ({archived.length})
            </summary>
            <div className="mt-3 space-y-2">
              {archived.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  bookings={bookings.get(trip.id) ?? 0}
                  pending={pending.byTrip.get(trip.id) ?? 0}
                />
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
