import Link from "next/link";

import { Nav } from "@/components/nav";
import { SegmentCard } from "@/components/segment-card";
import { SetupNotice } from "@/components/setup-notice";
import {
  CURRENT_TRIP,
  PETS_FILTER_ID,
  TRAVELERS,
  TRIPS,
  legById,
  tripById,
  type Trip,
} from "@/lib/config";
import type { Segment } from "@/lib/db/schema";
import {
  filterByTraveler,
  filterByTrip,
  getPendingCount,
  getTimelineSegments,
  groupByDay,
  nextUpcoming,
  resolveLeg,
} from "@/lib/queries";
import {
  formatDayHeading,
  isoDateToDate,
  relativeDays,
} from "@/lib/time";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Timeline URL for a trip and traveler filter; the current trip needs no param. */
function timelineHref(tripId: string, who: string | null): string {
  const params = new URLSearchParams();
  if (tripId !== CURRENT_TRIP.id) params.set("trip", tripId);
  if (who) params.set("who", who);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function TripSwitcher({ active, who }: { active: Trip; who: string | null }) {
  // Newest first: the trip being planned is the one you want to reach.
  const trips = [...TRIPS].reverse();
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2">
        {trips.map((trip) => {
          const selected = trip.id === active.id;
          return (
            <Link
              key={trip.id}
              href={timelineHref(trip.id, who)}
              className={`flex min-h-11 shrink-0 flex-col justify-center rounded-xl border px-3.5 py-1.5 transition ${
                selected
                  ? "border-stone-900 bg-surface"
                  : "border-edge text-muted hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">{trip.name}</span>
              <span className="text-xs text-muted">
                {trip.id === CURRENT_TRIP.id ? "Current trip" : trip.summary}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Milestones({ trip }: { trip: Trip }) {
  if (trip.milestones.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {trip.milestones.map((milestone) => {
        const date = isoDateToDate(milestone.date, milestone.timezone);
        return (
          <div
            key={milestone.label}
            className="rounded-xl border border-edge bg-surface px-4 py-3"
          >
            <p className="text-xs tracking-wide text-muted uppercase">
              {milestone.label}
            </p>
            <p className="mt-1 font-medium">
              {formatDayHeading(milestone.date)}
            </p>
            <p className="text-sm text-muted">
              {relativeDays(date, milestone.timezone)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function TravelerFilter({
  active,
  tripId,
}: {
  active: string | null;
  tripId: string;
}) {
  const options = [
    { id: null, label: "Everyone" },
    ...TRAVELERS.map((t) => ({ id: t.id as string | null, label: t.name })),
    // Both dogs behind one tab — what's happening at home is a single question.
    { id: PETS_FILTER_ID as string | null, label: "🐕 Pets" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = active === option.id;
        return (
          <Link
            key={option.label}
            href={timelineHref(tripId, option.id)}
            className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition ${
              selected
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-edge bg-surface text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function LegHeading({ legId }: { legId: string }) {
  const leg = legById(legId);
  // "Unscheduled / No date set" is noise: the day heading already says the
  // date is missing, so anything not on a known leg gets no heading at all.
  if (!leg || leg.id === "unscheduled") return null;

  return (
    <div className="mt-8 flex flex-wrap items-baseline gap-x-2 first:mt-0">
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        {leg.label}
      </h2>
      <span className="text-xs text-muted">{leg.place}</span>
    </div>
  );
}

function UpNext({ segment }: { segment: Segment }) {
  if (!segment.startAt) return null;
  return (
    <div className="rounded-xl border border-edge bg-surface px-4 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">Up next</p>
      <p className="mt-1 font-medium">{segment.title}</p>
      <p className="text-sm text-muted">
        {relativeDays(segment.startAt, segment.startTz)}
      </p>
    </div>
  );
}

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const who = firstParam(params.who);
  const trip = tripById(firstParam(params.trip)) ?? CURRENT_TRIP;

  let all: Segment[];
  let pendingCount: number;
  try {
    [all, pendingCount] = await Promise.all([
      getTimelineSegments(),
      getPendingCount(),
    ]);
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const visible = filterByTraveler(filterByTrip(all, trip), who);
  const upcoming = nextUpcoming(visible);

  // Work out the leg heading for each day up front: a label is only shown when
  // the trip actually moves on, so it can't be decided during render.
  const days = groupByDay(visible).map((day, index, list) => {
    const legId = day.segments[0] ? resolveLeg(day.segments[0]) : "unscheduled";
    const previous = list[index - 1];
    const previousLeg = previous?.segments[0]
      ? resolveLeg(previous.segments[0])
      : index === 0
        ? null
        : "unscheduled";
    return { ...day, legId, showLeg: legId !== previousLeg };
  });

  return (
    <>
      <Nav pendingCount={pendingCount} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <TripSwitcher active={trip} who={who} />

        <div className="mt-4 space-y-3">
          <Milestones trip={trip} />
          {upcoming && <UpNext segment={upcoming} />}
        </div>

        <div className="mt-6">
          <TravelerFilter active={who} tripId={trip.id} />
        </div>

        {days.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-edge px-4 py-10 text-center">
            <p className="font-medium">
              Nothing booked for {trip.name} yet
            </p>
            <p className="mt-1 text-sm text-muted">
              Add something by hand, or forward a confirmation email to your
              trip address and it&apos;ll appear in Review.
            </p>
            <Link href="/add" className="btn-primary mt-4">
              Add the first thing
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            {days.map((day) => (
              <section key={day.date}>
                {day.showLeg && <LegHeading legId={day.legId} />}

                <h3 className="mt-4 mb-2 text-sm font-medium text-muted">
                  {day.date === "unknown"
                    ? "No date yet"
                    : formatDayHeading(day.date)}
                </h3>

                <div className="space-y-2">
                  {day.segments.map((segment) => (
                    <SegmentCard key={segment.id} segment={segment} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
