import { locateSegments } from "@/app/actions";
import { MapCanvas } from "@/components/map-canvas";
import type { MapPlace } from "@/components/map-view";
import { Nav } from "@/components/nav";
import { SetupNotice } from "@/components/setup-notice";
import type { Segment } from "@/lib/db/schema";
import { kindMeta } from "@/lib/kinds";
import { getPendingCount, getTimelineSegments } from "@/lib/queries";
import { formatDate, formatTimeWithZone } from "@/lib/time";

/** Where a booking sits on the map, and what to say about it in the popup. */
function toPlace(segment: Segment): MapPlace | null {
  // A stay or a dinner only has a destination; treat that as its location.
  const lat = segment.fromLat ?? segment.toLat;
  const lng = segment.fromLng ?? segment.toLng;
  if (lat === null || lng === null) return null;

  const journey =
    segment.fromLat !== null &&
    segment.fromLng !== null &&
    segment.toLat !== null &&
    segment.toLng !== null;

  const when = segment.startAt
    ? `${formatDate(segment.startAt, segment.startTz)} · ${formatTimeWithZone(
        segment.startAt,
        segment.startTz,
        segment.fromCity,
      )}`
    : "No date set";

  return {
    id: segment.id,
    title: segment.title,
    kind: segment.kind,
    icon: kindMeta(segment.kind).icon,
    when,
    lat,
    lng,
    to: journey ? { lat: segment.toLat!, lng: segment.toLng! } : null,
  };
}

// Trip data is per-request and changes constantly; never prerender it.
export const dynamic = "force-dynamic";

export default async function MapPage() {
  let all: Segment[];
  let pendingCount = 0;
  try {
    [all, pendingCount] = await Promise.all([
      getTimelineSegments(),
      getPendingCount(),
    ]);
  } catch (error) {
    return <SetupNotice error={error} />;
  }

  const places = all
    .map(toPlace)
    .filter((place): place is MapPlace => place !== null);

  const unlocated = all.filter((s) => s.geocodedAt === null).length;
  const unplaceable = all.length - places.length - unlocated;

  return (
    <>
      <Nav pendingCount={pendingCount} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Map</h1>
            <p className="mt-1 text-sm text-muted">
              {places.length > 0
                ? "Every booking we can place, with journeys drawn between their ends."
                : "Nothing has been placed on the map yet."}
            </p>
          </div>

          {unlocated > 0 && (
            <form action={locateSegments}>
              <button type="submit" className="btn-secondary min-h-10 text-xs">
                Locate {unlocated} more
              </button>
            </form>
          )}
        </div>

        {places.length > 0 ? (
          <MapCanvas places={places} />
        ) : (
          <div className="rounded-xl border border-dashed border-edge px-4 py-10 text-center text-sm text-muted">
            Press <strong>Locate</strong> above to look up coordinates for your
            bookings. It takes about a second each, so it runs in batches.
          </div>
        )}

        <p className="mt-3 text-xs text-muted">
          {places.length} placed
          {unlocated > 0 && ` · ${unlocated} not looked up yet`}
          {unplaceable > 0 && ` · ${unplaceable} with no findable address`}
        </p>
      </main>
    </>
  );
}
