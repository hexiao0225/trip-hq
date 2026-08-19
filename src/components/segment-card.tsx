import Link from "next/link";

import { companionById } from "@/lib/config";
import type { Segment } from "@/lib/db/schema";
import { kindMeta } from "@/lib/kinds";
import {
  formatDate,
  formatDuration,
  formatTimeWithZone,
  nightsBetween,
} from "@/lib/time";

function TravelerBadges({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="flex gap-1">
      {ids.map((id) => {
        const traveler = companionById(id);
        if (!traveler) return null;
        return (
          <span
            key={id}
            title={traveler.name}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${traveler.badgeClass}`}
          >
            {traveler.initial}
          </span>
        );
      })}
    </span>
  );
}

/**
 * "San Francisco (SFO)" — city first, since the code is only meaningful if you
 * already know it. Null when there's nothing to show, so a segment with no
 * route (an activity, a stay) renders no route line at all.
 */
function endpointLabel(
  city: string | null,
  label: string | null,
): string | null {
  const cityName = city?.trim();
  const code = label?.trim();
  if (cityName && code) {
    // Don't repeat "London (London King's Cross)".
    return code.toLowerCase().includes(cityName.toLowerCase())
      ? code
      : `${cityName} (${code})`;
  }
  return cityName || code || null;
}

/**
 * The route line. An arrow only makes sense with both ends — a one-sided
 * booking shows the place it does know rather than pointing at a "?".
 */
function routeLabel(segment: Segment): string | null {
  const from = endpointLabel(segment.fromCity, segment.fromLabel);
  const to = endpointLabel(segment.toCity, segment.toLabel);
  if (from && to) return `${from} → ${to}`;
  return from ?? to;
}

/**
 * What to hand Google Maps. Prefers a street address, then the destination of
 * a journey, then the place itself — enough to be useful from a taxi.
 */
function mapsQuery(segment: Segment): string | null {
  if (segment.address?.trim()) return segment.address.trim();

  const destination = [segment.toLabel, segment.toCity]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  if (destination) return destination;

  const origin = [segment.fromLabel, segment.fromCity]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return origin || null;
}

function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * The location line, doubling as the map link. The pin marks it as tappable
 * without spending a whole row on a labelled button.
 */
function MapLink({ query, label }: { query: string | null; label: string }) {
  if (!query) return <p className="mt-0.5 text-sm text-muted">{label}</p>;
  return (
    <p className="mt-0.5 text-sm">
      <a
        href={mapsUrl(query)}
        target="_blank"
        rel="noreferrer"
        title="Open in Google Maps"
        className="inline-flex items-start gap-1 py-0.5 text-muted underline-offset-2 transition hover:text-foreground hover:underline"
      >
        <span aria-hidden>📍</span>
        <span>{label}</span>
      </a>
    </p>
  );
}

/**
 * Describes when the segment happens, in words that suit its kind: a duration
 * for flights, a night count for stays, a plain time for everything else.
 */
function Timing({ segment }: { segment: Segment }) {
  const { startAt, endAt, startTz, endTz } = segment;
  const meta = kindMeta(segment.kind);

  if (!startAt) {
    return <span className="text-muted">No date set</span>;
  }

  const start = formatTimeWithZone(startAt, startTz, segment.fromCity);

  if (!endAt) return <span>{start}</span>;

  const arrivalZone = endTz ?? startTz;
  const arrivalCity = segment.toCity ?? segment.fromCity;

  // Stays and hires span days, so a night/day count reads better than the
  // raw duration a flight would want ("4 days", not "96h").
  if (meta.ranged) {
    const span = nightsBetween(startAt, endAt, startTz);
    const unit = meta.id === "hotel" ? "night" : "day";
    return (
      <span>
        {start} → {formatDate(endAt, arrivalZone)}
        {span > 0 && (
          <span className="text-muted">
            {" "}
            · {span} {span === 1 ? unit : `${unit}s`}
          </span>
        )}
      </span>
    );
  }

  const sameDay =
    formatDate(startAt, startTz) === formatDate(endAt, arrivalZone);
  const end = formatTimeWithZone(endAt, arrivalZone, arrivalCity);
  const duration = formatDuration(startAt, endAt);

  return (
    <span>
      {start} → {sameDay ? end : `${formatDate(endAt, arrivalZone)}, ${end}`}
      {duration && <span className="text-muted"> · {duration}</span>}
    </span>
  );
}

export function SegmentCard({
  segment,
  tripSlug,
}: {
  segment: Segment;
  /** The trip whose pages this card is being shown on, for the edit link. */
  tripSlug: string;
}) {
  const meta = kindMeta(segment.kind);
  const cancelled = segment.status === "cancelled";
  const query = mapsQuery(segment);
  const route = routeLabel(segment);

  // The location line is the map link, so no separate button is needed. A
  // street address is the better target when there is one; a flight has none,
  // so its route doubles as the link.
  const linkedAddress = segment.address?.trim() ?? null;
  const linkedRoute = !linkedAddress && query ? route : null;

  return (
    <div
      className={`rounded-xl border p-4 transition hover:shadow-sm ${meta.tintClass} ${
        cancelled ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg leading-none">
          {meta.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${meta.chipClass}`}
            >
              {meta.label}
            </span>
            {cancelled && (
              <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-red-700 uppercase">
                Cancelled
              </span>
            )}
            <TravelerBadges ids={segment.travelers} />
          </div>

          <h3 className={`mt-1.5 ${cancelled ? "line-through" : ""}`}>
            <Link
              href={`/t/${tripSlug}/segment/${segment.id}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {segment.title}
            </Link>
          </h3>

          {/*
            A street address supersedes the route line — otherwise a dinner
            reservation reads "London" and then the address that also says
            London, on the line below.
          */}
          {route && !linkedAddress && (
            linkedRoute ? (
              <MapLink query={query} label={route} />
            ) : (
              <p className="mt-0.5 text-sm text-muted">{route}</p>
            )
          )}

          {linkedAddress && <MapLink query={query} label={linkedAddress} />}

          <p className="mt-1.5 font-mono text-xs text-foreground/80">
            <Timing segment={segment} />
          </p>

          {(segment.vendor || segment.confirmation) && (
            <p className="mt-1 text-xs text-muted">
              {segment.vendor}
              {segment.vendor && segment.confirmation && " · "}
              {segment.confirmation && (
                <span className="font-mono">{segment.confirmation}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
