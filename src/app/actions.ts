"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPasscode,
  createSessionToken,
} from "@/lib/auth";
import { EVERYONE_IDS } from "@/lib/config";
import { getDb } from "@/lib/db";
import { geocodePlace } from "@/lib/geocode";
import { legs, segments } from "@/lib/db/schema";
import { processEmail } from "@/lib/ingest";
import { KIND_IDS } from "@/lib/kinds";
import { getTripById } from "@/lib/trips";
import { localInputToDate } from "@/lib/time";

export interface FormState {
  error?: string;
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const passcode = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!passcode) return { error: "Enter the passcode." };

  let ok = false;
  try {
    ok = checkPasscode(passcode);
  } catch {
    return { error: "APP_PASSCODE is not configured on the server." };
  }
  if (!ok) return { error: "That passcode doesn't match." };

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  // Only allow same-site redirects, so `?next=` can't bounce to another host.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

function readTravelers(formData: FormData): string[] {
  return formData
    .getAll("travelers")
    .map(String)
    .filter((id) => EVERYONE_IDS.includes(id));
}

function optional(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

/** Refresh every page that shows this trip's bookings. */
function revalidateTrip(slug: string) {
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/inbox`);
  revalidatePath(`/t/${slug}/map`);
  revalidatePath("/trips");
}

export async function saveSegment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = optional(formData, "id");

  const tripId = optional(formData, "tripId");
  if (!tripId) return { error: "Pick a trip for this booking." };
  const trip = await getTripById(tripId);
  if (!trip) return { error: "That trip no longer exists." };

  const kind = String(formData.get("kind") ?? "");
  if (!KIND_IDS.includes(kind)) return { error: "Pick a valid type." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give it a title." };

  const startTz = String(formData.get("startTz") ?? "UTC");
  const endTzRaw = String(formData.get("endTz") ?? "").trim();
  const endTz = endTzRaw || startTz;

  const startAt = localInputToDate(optional(formData, "startLocal"), startTz);
  const endAt = localInputToDate(optional(formData, "endLocal"), endTz);

  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    return { error: "The end time is before the start time." };
  }

  const travelers = readTravelers(formData);
  if (travelers.length === 0) return { error: "Pick at least one traveler." };

  // A leg from another trip would put the booking under a heading that isn't
  // on this trip's timeline, so it has to be checked rather than trusted.
  const legId = optional(formData, "legId");
  if (legId && !(await legBelongsTo(legId, tripId))) {
    return { error: "That leg isn't part of this trip." };
  }

  const values = {
    tripId,
    legId,
    kind,
    title,
    vendor: optional(formData, "vendor"),
    confirmation: optional(formData, "confirmation"),
    startAt,
    startTz,
    endAt,
    endTz: endAt ? endTz : null,
    fromLabel: optional(formData, "fromLabel"),
    toLabel: optional(formData, "toLabel"),
    fromCity: optional(formData, "fromCity"),
    toCity: optional(formData, "toCity"),
    address: optional(formData, "address"),
    travelers,
    status: String(formData.get("status") ?? "confirmed"),
    costAmount: optional(formData, "costAmount"),
    costCurrency: optional(formData, "costCurrency"),
    notes: optional(formData, "notes"),
    link: optional(formData, "link"),
    updatedAt: new Date(),
  };

  if (id) {
    await getDb().update(segments).set(values).where(eq(segments.id, id));
  } else {
    await getDb().insert(segments).values({ ...values, source: "manual" });
  }

  revalidateTrip(trip.slug);
  redirect(`/t/${trip.slug}`);
}

async function legBelongsTo(legId: string, tripId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ tripId: legs.tripId })
    .from(legs)
    .where(eq(legs.id, legId))
    .limit(1);
  return rows[0]?.tripId === tripId;
}

export async function deleteSegment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!id) return;
  await getDb().delete(segments).where(eq(segments.id, id));
  if (slug) revalidateTrip(slug);
  redirect(slug ? `/t/${slug}` : "/");
}

/** Move an email-parsed segment out of the review queue and onto the timeline. */
export async function confirmSegment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!id) return;

  // Confirming a booking that isn't on a trip would take it out of Review and
  // put it on no timeline at all. Review hides the button in that case; this
  // makes it true of the action too.
  await getDb()
    .update(segments)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(and(eq(segments.id, id), isNotNull(segments.tripId)));

  if (slug) revalidateTrip(slug);
}

export async function discardSegment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!id) return;
  await getDb().delete(segments).where(eq(segments.id, id));
  if (slug) revalidateTrip(slug);
}

/**
 * File a booking under a different trip.
 *
 * Used from Review for anything the parser couldn't place, and to correct a
 * booking that landed on the wrong trip. The leg is cleared rather than
 * remapped: leg ids belong to one trip, and the timeline will re-derive it
 * from the date.
 */
export async function assignSegmentTrip(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const tripId = String(formData.get("tripId") ?? "");
  const fromSlug = String(formData.get("tripSlug") ?? "");
  if (!id || !tripId) return;

  const trip = await getTripById(tripId);
  if (!trip) return;

  await getDb()
    .update(segments)
    .set({ tripId, legId: null, updatedAt: new Date() })
    .where(eq(segments.id, id));

  if (fromSlug) revalidateTrip(fromSlug);
  revalidateTrip(trip.slug);
}

/**
 * Fill in coordinates for anything the map can't place yet.
 *
 * Paced at roughly one lookup per second by the geocoder, so this is a
 * deliberate button rather than something that runs on page load. Each segment
 * is marked as attempted either way, so a place that simply can't be found
 * isn't retried on every visit.
 */
export async function locateSegments(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!tripId) return;

  const rows = await getDb()
    .select()
    .from(segments)
    .where(and(eq(segments.tripId, tripId), isNull(segments.geocodedAt)))
    .limit(12);

  for (const row of rows) {
    const from = await geocodePlace(row.fromLabel, row.fromCity, null);
    const to = await geocodePlace(row.toLabel, row.toCity, row.address);

    await getDb()
      .update(segments)
      .set({
        fromLat: from?.lat ?? null,
        fromLng: from?.lng ?? null,
        toLat: to?.lat ?? null,
        toLng: to?.lng ?? null,
        geocodedAt: new Date(),
      })
      .where(eq(segments.id, row.id));
  }

  if (slug) revalidatePath(`/t/${slug}/map`);
}

/** Re-run the model over a stored email after a failed or poor parse. */
export async function reparseEmail(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!id) return;
  try {
    await processEmail(id);
  } catch (error) {
    console.error("Re-parse failed", id, error);
  }
  if (slug) revalidateTrip(slug);
}
