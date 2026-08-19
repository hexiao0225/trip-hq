import "server-only";

import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { SegmentFormTrip } from "@/components/segment-form";
import { getDb } from "@/lib/db";
import {
  legs,
  milestones,
  segments,
  trips,
  type Leg,
  type Milestone,
  type Trip,
} from "@/lib/db/schema";
import { todayIn } from "@/lib/time";

/** A trip and everything that shapes its timeline, loaded in one go. */
export interface TripContext {
  trip: Trip;
  legs: Leg[];
  milestones: Milestone[];
}

/**
 * Where a trip sits relative to today.
 *
 * "planning" is a trip with no dates yet, which is how one starts — it can't be
 * sorted against the others, so it's kept separate rather than guessed at.
 */
export type TripPhase = "planning" | "upcoming" | "current" | "past";

export function tripPhase(trip: Trip): TripPhase {
  if (!trip.startDate && !trip.endDate) return "planning";

  const today = todayIn(trip.timezone);
  const start = trip.startDate ?? trip.endDate!;
  const end = trip.endDate ?? trip.startDate!;

  if (today < start) return "upcoming";
  if (today > end) return "past";
  return "current";
}

/**
 * Sort trips the way they're thought about: what's happening now, then what's
 * coming, then everything still being planned, then the ones already taken.
 */
const PHASE_ORDER: Record<TripPhase, number> = {
  current: 0,
  upcoming: 1,
  planning: 2,
  past: 3,
};

export function sortTrips(rows: Trip[]): Trip[] {
  return [...rows].sort((a, b) => {
    const phaseDiff = PHASE_ORDER[tripPhase(a)] - PHASE_ORDER[tripPhase(b)];
    if (phaseDiff !== 0) return phaseDiff;

    // Within a phase, soonest first — except past trips, most recent first.
    const aDate = a.startDate ?? a.endDate ?? "";
    const bDate = b.startDate ?? b.endDate ?? "";
    if (aDate !== bDate) {
      const ascending = aDate.localeCompare(bDate);
      return tripPhase(a) === "past" ? -ascending : ascending;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function getTrips({
  includeArchived = false,
}: { includeArchived?: boolean } = {}): Promise<Trip[]> {
  const rows = await getDb()
    .select()
    .from(trips)
    .where(includeArchived ? undefined : isNull(trips.archivedAt));
  return sortTrips(rows);
}

export async function getTripBySlug(slug: string): Promise<Trip | undefined> {
  const rows = await getDb()
    .select()
    .from(trips)
    .where(eq(trips.slug, slug))
    .limit(1);
  return rows[0];
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const rows = await getDb().select().from(trips).where(eq(trips.id, id)).limit(1);
  return rows[0];
}

export async function getLegs(tripId: string): Promise<Leg[]> {
  return getDb()
    .select()
    .from(legs)
    .where(eq(legs.tripId, tripId))
    .orderBy(asc(legs.position), asc(legs.startDate));
}

export async function getMilestones(tripId: string): Promise<Milestone[]> {
  return getDb()
    .select()
    .from(milestones)
    .where(eq(milestones.tripId, tripId))
    .orderBy(asc(milestones.date), asc(milestones.position));
}

/** Everything a trip's pages need: the trip, its legs and its milestones. */
export async function getTripContext(
  slug: string,
): Promise<TripContext | null> {
  const trip = await getTripBySlug(slug);
  if (!trip) return null;

  const [tripLegs, tripMilestones] = await Promise.all([
    getLegs(trip.id),
    getMilestones(trip.id),
  ]);

  return { trip, legs: tripLegs, milestones: tripMilestones };
}

/** Shape a loaded trip for the booking form, which runs on the client. */
export function toFormTrip(context: TripContext): SegmentFormTrip {
  return {
    id: context.trip.id,
    slug: context.trip.slug,
    timezone: context.trip.timezone,
    currency: context.trip.currency,
    travelers: context.trip.travelers,
    legs: context.legs.map((leg) => ({
      id: leg.id,
      label: leg.label,
      timezone: leg.timezone,
    })),
  };
}

/**
 * The trip to open when none is named — what's happening now, or next.
 * Falls back to whatever exists, so the app is never stuck with no trip.
 */
export function defaultTrip(rows: Trip[]): Trip | undefined {
  return sortTrips(rows)[0];
}

/**
 * How many bookings are waiting for review, per trip.
 *
 * Anything not yet filed to a trip is counted for every trip, so a forwarded
 * email that couldn't be matched is visible wherever you happen to be rather
 * than hidden behind the right tab.
 */
export async function getPendingCounts(): Promise<{
  byTrip: Map<string, number>;
  unassigned: number;
}> {
  const rows = await getDb()
    .select({ id: segments.id, tripId: segments.tripId })
    .from(segments)
    .where(eq(segments.status, "pending"));

  const byTrip = new Map<string, number>();
  let unassigned = 0;

  for (const row of rows) {
    if (!row.tripId) {
      unassigned += 1;
      continue;
    }
    byTrip.set(row.tripId, (byTrip.get(row.tripId) ?? 0) + 1);
  }

  return { byTrip, unassigned };
}

/** The badge on the Review tab: this trip's queue, plus anything unfiled. */
export async function getPendingCount(tripId: string): Promise<number> {
  const rows = await getDb()
    .select({ id: segments.id })
    .from(segments)
    .where(
      and(
        eq(segments.status, "pending"),
        or(eq(segments.tripId, tripId), isNull(segments.tripId)),
      ),
    );
  return rows.length;
}

/** How many bookings each trip has on its timeline. */
export async function getSegmentCounts(): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ tripId: segments.tripId, status: segments.status })
    .from(segments);

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.tripId || row.status === "pending") continue;
    counts.set(row.tripId, (counts.get(row.tripId) ?? 0) + 1);
  }
  return counts;
}

/**
 * The trip a date falls inside, used to file a forwarded booking when the
 * model didn't name a trip. Only trips with both bounds set can claim a date.
 */
export function tripForDate(
  rows: Trip[],
  iso: string | null | undefined,
): Trip | undefined {
  if (!iso) return undefined;
  return rows.find(
    (trip) =>
      trip.startDate &&
      trip.endDate &&
      iso >= trip.startDate &&
      iso <= trip.endDate,
  );
}

/** The leg a date falls inside, for filing a booking under the right heading. */
export function legForDate(
  rows: Leg[],
  iso: string | null | undefined,
): Leg | undefined {
  if (!iso) return undefined;
  return rows.find(
    (leg) =>
      leg.startDate && leg.endDate && iso >= leg.startDate && iso <= leg.endDate,
  );
}

/** "Singapore & Bali" → "singapore-bali". */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Reserved because they are real routes, not trips. */
const RESERVED_SLUGS = ["new", "api", "login", "trips", "t"];

/**
 * A slug no other trip is using. Two trips to the same city are common enough
 * — "tokyo", then "tokyo-2" — that a collision shouldn't be an error message.
 */
export async function uniqueSlug(
  desired: string,
  exceptTripId?: string,
): Promise<string> {
  const base = slugify(desired) || "trip";
  const rows = await getDb().select({ id: trips.id, slug: trips.slug }).from(trips);
  const taken = new Set(
    rows.filter((r) => r.id !== exceptTripId).map((r) => r.slug),
  );
  RESERVED_SLUGS.forEach((slug) => taken.add(slug));

  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
