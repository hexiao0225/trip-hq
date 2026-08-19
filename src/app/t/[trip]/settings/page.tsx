import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveTrip } from "@/app/trip-actions";
import { DeleteTripForm } from "@/components/delete-trip-form";
import { LegEditor } from "@/components/leg-editor";
import { MilestoneEditor } from "@/components/milestone-editor";
import { Nav } from "@/components/nav";
import { SetupNotice } from "@/components/setup-notice";
import { TripForm } from "@/components/trip-form";
import { HOME_TIMEZONE } from "@/lib/config";
import { getNavData } from "@/lib/nav";
import { getTripContext, type TripContext } from "@/lib/trips";

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function TripSettingsPage({
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

  const { trip, legs, milestones } = context;

  return (
    <>
      <Nav trip={nav.current} trips={nav.trips} pendingCount={nav.pendingCount} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {trip.name} settings
          </h1>
          <Link
            href={`/t/${trip.slug}`}
            className="text-sm text-muted underline-offset-2 hover:underline"
          >
            Back to the timeline
          </Link>
        </div>

        <section className="mt-6">
          <TripForm
            initial={{
              id: trip.id,
              slug: trip.slug,
              name: trip.name,
              destination: trip.destination ?? "",
              emoji: trip.emoji ?? "",
              startDate: trip.startDate ?? "",
              endDate: trip.endDate ?? "",
              timezone: trip.timezone,
              currency: trip.currency ?? "",
              travelers: trip.travelers,
              accent: trip.accent,
              notes: trip.notes ?? "",
            }}
            defaultTimezone={trip.timezone || HOME_TIMEZONE}
          />
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Legs</h2>
          <p className="mt-1 text-sm text-muted">
            The stretches this trip breaks into. Give one a date range and
            anything booked inside it groups under that heading by itself.
          </p>

          <div className="mt-3 space-y-2">
            {legs.map((leg) => (
              <LegEditor
                key={leg.id}
                tripId={trip.id}
                tripSlug={trip.slug}
                tripTimezone={trip.timezone}
                initial={{
                  id: leg.id,
                  label: leg.label,
                  place: leg.place ?? "",
                  timezone: leg.timezone,
                  startDate: leg.startDate ?? "",
                  endDate: leg.endDate ?? "",
                  travelers: leg.travelers,
                  accent: leg.accent,
                  position: leg.position,
                }}
              />
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs tracking-wide text-muted uppercase">
              Add a leg
            </p>
            <LegEditor
              // Remounts once a leg is added, which clears the fields rather
              // than leaving the last one typed in the blank row.
              key={`new-leg-${legs.length}`}
              tripId={trip.id}
              tripSlug={trip.slug}
              tripTimezone={trip.timezone}
              initial={null}
              defaultPosition={legs.length}
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Milestones
          </h2>
          <p className="mt-1 text-sm text-muted">
            The fixed points this trip is planned around. They show as
            countdowns at the top of the timeline.
          </p>

          <div className="mt-3 space-y-2">
            {milestones.map((milestone) => (
              <MilestoneEditor
                key={milestone.id}
                tripId={trip.id}
                tripSlug={trip.slug}
                tripTimezone={trip.timezone}
                initial={{
                  id: milestone.id,
                  label: milestone.label,
                  date: milestone.date,
                  timezone: milestone.timezone,
                  who: milestone.who,
                }}
              />
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs tracking-wide text-muted uppercase">
              Add a milestone
            </p>
            <MilestoneEditor
              key={`new-milestone-${milestones.length}`}
              tripId={trip.id}
              tripSlug={trip.slug}
              tripTimezone={trip.timezone}
              initial={null}
            />
          </div>
        </section>

        <section className="mt-12 border-t border-edge pt-6">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Finishing with this trip
          </h2>

          <div className="mt-3 space-y-3">
            <form action={archiveTrip} className="flex items-center gap-3">
              <input type="hidden" name="id" value={trip.id} />
              <input
                type="hidden"
                name="archived"
                value={trip.archivedAt ? "false" : "true"}
              />
              <button type="submit" className="btn-secondary">
                {trip.archivedAt ? "Unarchive this trip" : "Archive this trip"}
              </button>
              <span className="text-sm text-muted">
                {trip.archivedAt
                  ? "Currently hidden from the switcher."
                  : "Hides it from the switcher, keeping everything."}
              </span>
            </form>

            <DeleteTripForm tripId={trip.id} tripName={trip.name} />
          </div>
        </section>
      </main>
    </>
  );
}
