import Link from "next/link";
import { notFound } from "next/navigation";

import {
  assignSegmentTrip,
  confirmSegment,
  discardSegment,
  reparseEmail,
} from "@/app/actions";
import { Nav } from "@/components/nav";
import { SegmentCard } from "@/components/segment-card";
import { SetupNotice } from "@/components/setup-notice";
import type { InboundEmail, Segment, Trip } from "@/lib/db/schema";
import { getNavData } from "@/lib/nav";
import { getPendingSegments, getRecentEmails } from "@/lib/queries";
import { formatDayHeading } from "@/lib/time";
import { getTripBySlug, getTrips } from "@/lib/trips";

const STATUS_STYLES: Record<string, string> = {
  parsed: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  ignored: "bg-stone-100 text-stone-700",
};

function EmailRow({ email, tripSlug }: { email: InboundEmail; tripSlug: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edge px-4 py-3 last:border-b-0">
      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
          STATUS_STYLES[email.parseStatus] ?? STATUS_STYLES.ignored
        }`}
      >
        {email.parseStatus}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">
        {email.subject ?? "(no subject)"}
        <span className="text-muted"> · {email.fromAddress ?? "unknown"}</span>
      </span>

      {email.parseError && (
        <span className="w-full text-xs text-muted">{email.parseError}</span>
      )}

      <form action={reparseEmail}>
        <input type="hidden" name="id" value={email.id} />
        <input type="hidden" name="tripSlug" value={tripSlug} />
        <button type="submit" className="btn-secondary min-h-10 px-3 text-xs">
          Re-parse
        </button>
      </form>

      {/*
        The original text, for working out why a parse came out wrong — and for
        reading one-off codes, such as the confirmation Gmail sends when you set
        up an automatic forwarding rule to this address.
      */}
      <details className="w-full">
        <summary className="cursor-pointer text-xs text-muted select-none hover:text-foreground">
          View original email
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-edge bg-background p-3 text-xs whitespace-pre-wrap">
          {email.body}
        </pre>
      </details>
    </li>
  );
}

/** Move a booking to another trip, or file one the parser couldn't place. */
function TripPicker({
  segment,
  trips,
  currentSlug,
  label,
}: {
  segment: Segment;
  trips: Trip[];
  currentSlug: string;
  label: string;
}) {
  return (
    <form action={assignSegmentTrip} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={segment.id} />
      <input type="hidden" name="tripSlug" value={currentSlug} />
      <label className="sr-only" htmlFor={`trip-${segment.id}`}>
        Trip for {segment.title}
      </label>
      <select
        id={`trip-${segment.id}`}
        name="tripId"
        defaultValue={segment.tripId ?? ""}
        className="field min-h-10 w-auto py-1 text-xs"
      >
        {segment.tripId === null && <option value="">Which trip?</option>}
        {trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {trip.emoji ? `${trip.emoji} ` : ""}
            {trip.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-secondary min-h-10 px-3 text-xs">
        {label}
      </button>
    </form>
  );
}

function PendingItem({
  segment,
  trips,
  currentSlug,
}: {
  segment: Segment;
  trips: Trip[];
  currentSlug: string;
}) {
  const unfiled = segment.tripId === null;

  return (
    // Neutral dashed frame rather than an amber fill, so it reads as "not
    // accepted yet" without fighting the card's own kind tint inside it.
    <div className="rounded-xl border border-dashed border-stone-300 p-2">
      <SegmentCard segment={segment} tripSlug={currentSlug} />

      <div className="mt-2 flex flex-wrap items-center gap-2 px-2 pb-1">
        {unfiled ? (
          // Confirming an unfiled booking would put it on no timeline at all,
          // so the trip has to be chosen first.
          <TripPicker
            segment={segment}
            trips={trips}
            currentSlug={currentSlug}
            label="File it"
          />
        ) : (
          <>
            <form action={confirmSegment}>
              <input type="hidden" name="id" value={segment.id} />
              <input type="hidden" name="tripSlug" value={currentSlug} />
              <button type="submit" className="btn-primary min-h-10 px-3 text-xs">
                Add to timeline
              </button>
            </form>

            <Link
              href={`/t/${currentSlug}/segment/${segment.id}`}
              className="btn-secondary min-h-10 px-3 text-xs"
            >
              Edit first
            </Link>
          </>
        )}

        <form action={discardSegment}>
          <input type="hidden" name="id" value={segment.id} />
          <input type="hidden" name="tripSlug" value={currentSlug} />
          <button type="submit" className="btn-danger min-h-10 px-3 text-xs">
            Discard
          </button>
        </form>

        {!unfiled && trips.length > 1 && (
          <TripPicker
            segment={segment}
            trips={trips}
            currentSlug={currentSlug}
            label="Move"
          />
        )}
      </div>
    </div>
  );
}

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ trip: string }>;
}) {
  const { trip: slug } = await params;

  let loaded: {
    trip: Trip | undefined;
    pending: Segment[];
    emails: InboundEmail[];
    trips: Trip[];
    nav: Awaited<ReturnType<typeof getNavData>>;
  };
  try {
    const trip = await getTripBySlug(slug);
    const [pending, emails, trips, nav] = await Promise.all([
      trip ? getPendingSegments(trip.id) : Promise.resolve([]),
      trip ? getRecentEmails(trip.id) : Promise.resolve([]),
      getTrips(),
      getNavData(slug),
    ]);
    loaded = { trip, pending, emails, trips, nav };
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const { trip, pending, emails, trips, nav } = loaded;
  if (!trip) notFound();

  const unfiled = pending.filter((segment) => segment.tripId === null);
  const mine = pending.filter((segment) => segment.tripId !== null);

  return (
    <>
      <Nav trip={nav.current} trips={nav.trips} pendingCount={nav.pendingCount} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold tracking-tight">Review</h1>
        <p className="mt-1 text-sm text-muted">
          Anything parsed out of a forwarded email waits here until you confirm
          it, so a bad read never lands on a timeline.
        </p>

        {unfiled.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Waiting for a trip
            </h2>
            <p className="mt-1 text-sm text-muted">
              These didn&apos;t match any trip&apos;s dates or destination.
              They show up under every trip until one is chosen.
            </p>
            <div className="mt-3 space-y-3">
              {unfiled.map((segment) => (
                <PendingItem
                  key={segment.id}
                  segment={segment}
                  trips={trips}
                  currentSlug={trip.slug}
                />
              ))}
            </div>
          </section>
        )}

        <h2 className="mt-8 text-sm font-semibold tracking-wide uppercase">
          On {trip.name}
        </h2>

        {mine.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
            Nothing waiting. Forward a confirmation email to your trip address
            and it&apos;ll show up here.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {mine.map((segment) => (
              <PendingItem
                key={segment.id}
                segment={segment}
                trips={trips}
                currentSlug={trip.slug}
              />
            ))}
          </div>
        )}

        <h2 className="mt-10 text-sm font-semibold tracking-wide uppercase">
          Recent emails
        </h2>

        {emails.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No emails received yet. See the README for connecting an inbound
            address.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-edge bg-surface">
            {emails.map((email) => (
              <EmailRow key={email.id} email={email} tripSlug={trip.slug} />
            ))}
          </ul>
        )}

        {emails.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Most recent:{" "}
            {formatDayHeading(emails[0].receivedAt.toISOString().slice(0, 10))}
          </p>
        )}
      </main>
    </>
  );
}
