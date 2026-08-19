import "server-only";

import type { TripLink } from "@/components/trip-switcher";
import type { Trip } from "@/lib/db/schema";
import { formatDateRange, isoDateToDate, relativeDays } from "@/lib/time";
import { getPendingCounts, getTrips, tripPhase } from "@/lib/trips";

/** The one line under a trip's name in the switcher and on the trips page. */
export function tripWhen(trip: Trip): string {
  switch (tripPhase(trip)) {
    case "current":
      return trip.endDate
        ? `In progress · ends ${relativeDays(
            isoDateToDate(trip.endDate, trip.timezone),
            trip.timezone,
          )}`
        : "In progress";
    case "upcoming":
      return trip.startDate
        ? `Starts ${relativeDays(
            isoDateToDate(trip.startDate, trip.timezone),
            trip.timezone,
          )}`
        : "Coming up";
    case "past":
      return formatDateRange(trip.startDate, trip.endDate);
    case "planning":
      return "Still being planned";
  }
}

export function toTripLink(trip: Trip, pending: number): TripLink {
  return {
    slug: trip.slug,
    name: trip.name,
    emoji: trip.emoji,
    accent: trip.accent,
    when: tripWhen(trip),
    pending,
  };
}

export interface NavData {
  trips: TripLink[];
  current: TripLink | null;
  /** This trip's review queue, including anything not yet filed to a trip. */
  pendingCount: number;
}

/**
 * Everything the header needs, in one round trip: the trips to switch between
 * and how many bookings each has waiting.
 */
export async function getNavData(currentSlug?: string): Promise<NavData> {
  const [trips, pending] = await Promise.all([getTrips(), getPendingCounts()]);

  const links = trips.map((trip) =>
    toTripLink(trip, pending.byTrip.get(trip.id) ?? 0),
  );

  const current = currentSlug
    ? (links.find((link) => link.slug === currentSlug) ?? null)
    : null;

  const own = current
    ? (trips.find((trip) => trip.slug === current.slug)?.id ?? null)
    : null;

  return {
    trips: links,
    current,
    pendingCount:
      (own ? (pending.byTrip.get(own) ?? 0) : 0) + pending.unassigned,
  };
}
