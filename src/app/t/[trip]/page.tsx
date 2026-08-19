import Link from "next/link";
import { notFound } from "next/navigation";

import { Nav } from "@/components/nav";
import { SegmentCard } from "@/components/segment-card";
import { SetupNotice } from "@/components/setup-notice";
import { accent } from "@/lib/accents";
import { PETS_FILTER_ID, TRAVELERS, companionById } from "@/lib/config";
import type { Leg, Segment } from "@/lib/db/schema";
import { getNavData } from "@/lib/nav";
import {
  filterByTraveler,
  getTimelineSegments,
  groupByDay,
  nextUpcoming,
  resolveLeg,
} from "@/lib/queries";
import {
  formatDateRange,
  formatDayHeading,
  isoDateToDate,
  relativeDays,
} from "@/lib/time";
import { getTripContext, type TripContext } from "@/lib/trips";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function Milestones({ context }: { context: TripContext }) {
  const { trip, milestones } = context;

  // With no milestones set, the trip's own dates are the countdown worth
  // showing — a new trip shouldn't open on an empty strip of nothing.
  if (milestones.length === 0) {
    if (!trip.startDate && !trip.endDate) return null;
    const anchor = trip.startDate ?? trip.endDate!;
    return (
      <div className="rounded-xl border border-edge bg-surface px-4 py-3">
        <p className="text-xs tracking-wide text-muted uppercase">
          {trip.startDate ? "Trip starts" : "Trip ends"}
        </p>
        <p className="mt-1 font-medium">
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>
        <p className="text-sm text-muted">
          {relativeDays(isoDateToDate(anchor, trip.timezone), trip.timezone)}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {milestones.map((milestone) => {
        const date = isoDateToDate(milestone.date, milestone.timezone);
        return (
          <div
            key={milestone.id}
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
  slug,
  travelers,
}: {
  active: string | null;
  slug: string;
  travelers: string[];
}) {
  // Only the people actually on this trip get a tab — a solo trip has no use
  // for a filter that always comes back empty.
  const people = TRAVELERS.filter((t) => travelers.includes(t.id));

  const options = [
    { id: null, label: "Everyone" },
    ...people.map((t) => ({ id: t.id as string | null, label: t.name })),
    // Both dogs behind one tab — what's happening at home is a single question.
    { id: PETS_FILTER_ID as string | null, label: "🐕 Pets" },
  ];

  if (options.length <= 2) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = active === option.id;
        return (
          <Link
            key={option.label}
            href={option.id ? `/t/${slug}?who=${option.id}` : `/t/${slug}`}
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

function LegHeading({ leg }: { leg: Leg }) {
  const who = leg.travelers
    .map((id) => companionById(id)?.name)
    .filter(Boolean)
    .join(" & ");

  return (
    <div
      className={`mt-8 flex flex-wrap items-baseline gap-x-2 border-l-2 pl-3 first:mt-0 ${
        accent(leg.accent).borderClass
      }`}
    >
      <h2 className="text-sm font-semibold tracking-wide uppercase">
        {leg.label}
      </h2>
      {leg.place && <span className="text-xs text-muted">{leg.place}</span>}
      {who && <span className="text-xs text-muted">· {who}</span>}
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
  params,
  searchParams,
}: {
  params: Promise<{ trip: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { trip: slug } = await params;
  const who = firstParam((await searchParams).who);

  // `notFound()` works by throwing, so it has to stay outside the try — a
  // catch here would swallow it and show the database-setup notice instead.
  let loaded: {
    context: TripContext | null;
    all: Segment[];
    nav: Awaited<ReturnType<typeof getNavData>>;
  };
  try {
    const context = await getTripContext(slug);
    const [all, nav] = await Promise.all([
      context ? getTimelineSegments(context.trip.id) : Promise.resolve([]),
      getNavData(slug),
    ]);
    loaded = { context, all, nav };
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const { context, all, nav } = loaded;
  if (!context) notFound();

  const { trip, legs } = context;
  const visible = filterByTraveler(all, who);
  const upcoming = nextUpcoming(visible);

  // Work out the leg heading for each day up front: a label is only shown when
  // the trip actually moves on, so it can't be decided during render.
  const days = groupByDay(visible).map((day, index, list) => {
    const leg = day.segments[0] ? resolveLeg(day.segments[0], legs) : null;
    const previous = list[index - 1];
    const previousLeg = previous?.segments[0]
      ? resolveLeg(previous.segments[0], legs)
      : null;
    return {
      ...day,
      leg,
      showLeg: Boolean(leg) && leg?.id !== previousLeg?.id,
    };
  });

  return (
    <>
      <Nav trip={nav.current} trips={nav.trips} pendingCount={nav.pendingCount} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="space-y-3">
          <Milestones context={context} />
          {upcoming && <UpNext segment={upcoming} />}
        </div>

        <div className="mt-6">
          <TravelerFilter
            active={who}
            slug={trip.slug}
            travelers={trip.travelers}
          />
        </div>

        {days.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-edge px-4 py-10 text-center">
            <p className="font-medium">Nothing booked yet</p>
            <p className="mt-1 text-sm text-muted">
              Add something by hand, or forward a confirmation email to your
              trip address and it&apos;ll appear in Review.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={`/t/${trip.slug}/add`} className="btn-primary">
                Add the first thing
              </Link>
              {legs.length === 0 && (
                <Link
                  href={`/t/${trip.slug}/settings`}
                  className="btn-secondary"
                >
                  Set up the legs
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            {days.map((day) => (
              <section key={day.date}>
                {day.showLeg && day.leg && <LegHeading leg={day.leg} />}

                <h3 className="mt-4 mb-2 text-sm font-medium text-muted">
                  {day.date === "unknown"
                    ? "No date yet"
                    : formatDayHeading(day.date)}
                </h3>

                <div className="space-y-2">
                  {day.segments.map((segment) => (
                    <SegmentCard
                      key={segment.id}
                      segment={segment}
                      tripSlug={trip.slug}
                    />
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
