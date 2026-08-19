import "server-only";

import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";

import { PETS_FILTER_ID, isPet } from "@/lib/config";
import { getDb } from "@/lib/db";
import {
  inboundEmails,
  segments,
  type Leg,
  type Segment,
} from "@/lib/db/schema";
import { dayKey } from "@/lib/time";

export interface DayGroup {
  /** ISO date in the day's own timezone, or "unknown" for undated segments. */
  date: string;
  segments: Segment[];
}

/** One trip's timeline, earliest first. Nulls last. */
export async function getTimelineSegments(tripId: string): Promise<Segment[]> {
  return getDb()
    .select()
    .from(segments)
    .where(and(eq(segments.tripId, tripId), ne(segments.status, "pending")))
    .orderBy(asc(segments.startAt), asc(segments.createdAt));
}

/**
 * Segments parsed from email that still need a human to confirm them, for one
 * trip — plus anything that hasn't been filed to a trip at all, which has to
 * surface somewhere or it would sit in the database unseen.
 */
export async function getPendingSegments(tripId: string): Promise<Segment[]> {
  return getDb()
    .select()
    .from(segments)
    .where(
      and(
        eq(segments.status, "pending"),
        or(eq(segments.tripId, tripId), isNull(segments.tripId)),
      ),
    )
    .orderBy(desc(segments.createdAt));
}

export async function getSegment(id: string): Promise<Segment | undefined> {
  const rows = await getDb()
    .select()
    .from(segments)
    .where(eq(segments.id, id))
    .limit(1);
  return rows[0];
}

/**
 * Recent forwarded email. Scoped to the trip its bookings were filed under,
 * with unrouted mail included — that's usually exactly what you're looking for
 * when something didn't arrive where you expected.
 */
export async function getRecentEmails(tripId: string, limit = 25) {
  return getDb()
    .select()
    .from(inboundEmails)
    .where(or(eq(inboundEmails.tripId, tripId), isNull(inboundEmails.tripId)))
    .orderBy(desc(inboundEmails.receivedAt))
    .limit(limit);
}

/**
 * Group segments into calendar days, using each segment's own timezone so a
 * red-eye landing at 06:00 in London files under the London date.
 */
export function groupByDay(rows: Segment[]): DayGroup[] {
  const groups = new Map<string, Segment[]>();

  for (const row of rows) {
    const key = row.startAt ? dayKey(row.startAt, row.startTz) : "unknown";
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      // Undated segments sort to the very end.
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return a.localeCompare(b);
    })
    .map(([date, items]) => ({ date, segments: items }));
}

/**
 * Which leg a segment belongs to. An explicit `legId` always wins; otherwise
 * fall back to matching the date against each leg's range.
 *
 * Returns null for anything that lands outside every leg, which the timeline
 * renders without a heading rather than under an "Unscheduled" one — the day
 * heading already says the date is missing.
 */
export function resolveLeg(row: Segment, legs: Leg[]): Leg | null {
  if (row.legId) {
    const explicit = legs.find((leg) => leg.id === row.legId);
    if (explicit) return explicit;
  }
  if (!row.startAt) return null;

  const iso = dayKey(row.startAt, row.startTz);
  return (
    legs.find(
      (leg) =>
        leg.startDate &&
        leg.endDate &&
        iso >= leg.startDate &&
        iso <= leg.endDate,
    ) ?? null
  );
}

/** Restrict a list to segments involving a given traveler, or either dog. */
export function filterByTraveler(
  rows: Segment[],
  travelerId: string | null,
): Segment[] {
  if (!travelerId) return rows;

  // The dogs share one tab. An unassigned segment counts as everyone's, but
  // it is not a dog's — so this branch requires an actual pet.
  if (travelerId === PETS_FILTER_ID) {
    return rows.filter((row) => row.travelers.some((id) => isPet(id)));
  }

  return rows.filter(
    (row) => row.travelers.length === 0 || row.travelers.includes(travelerId),
  );
}

/** The next thing happening, used for the "up next" card. */
export function nextUpcoming(rows: Segment[], now = new Date()): Segment | null {
  return (
    rows.find(
      (row) =>
        row.startAt !== null &&
        row.status !== "cancelled" &&
        row.startAt.getTime() >= now.getTime(),
    ) ?? null
  );
}
