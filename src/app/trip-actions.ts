"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ACCENT_IDS, nextAccent } from "@/lib/accents";
import { EVERYONE_IDS, HOME_TIMEZONE, TRAVELER_IDS } from "@/lib/config";
import { getDb } from "@/lib/db";
import { legs, milestones, trips } from "@/lib/db/schema";
import {
  getTripById,
  getTrips,
  slugify,
  uniqueSlug,
} from "@/lib/trips";

export interface FormState {
  error?: string;
}

function optional(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

/** A YYYY-MM-DD from a date input, or null. Anything else is rejected. */
function isoDate(formData: FormData, key: string): string | null {
  const value = optional(formData, key);
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function whoList(formData: FormData, key: string, allowed: string[]): string[] {
  return formData
    .getAll(key)
    .map(String)
    .filter((id) => allowed.includes(id));
}

function accentOrDefault(value: string | null, fallback: string): string {
  return value && ACCENT_IDS.includes(value) ? value : fallback;
}

/**
 * A trip's own emoji, capped at one character.
 *
 * Emoji are frequently more than one code unit — 🇬🇧 is two regional
 * indicators — so this counts by grapheme rather than by `.length`.
 */
function firstEmoji(value: string | null): string | null {
  if (!value) return null;
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const [first] = [...segmenter.segment(value)];
  return first?.segment ?? null;
}

export async function createTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the trip a name." };

  const startDate = isoDate(formData, "startDate");
  const endDate = isoDate(formData, "endDate");
  if (startDate && endDate && endDate < startDate) {
    return { error: "The trip ends before it starts." };
  }

  const existing = await getTrips({ includeArchived: true });
  const slug = await uniqueSlug(optional(formData, "slug") ?? name);

  const travelers = whoList(formData, "travelers", TRAVELER_IDS);

  const inserted = await getDb()
    .insert(trips)
    .values({
      slug,
      name,
      destination: optional(formData, "destination"),
      emoji: firstEmoji(optional(formData, "emoji")),
      startDate,
      endDate,
      timezone: optional(formData, "timezone") ?? HOME_TIMEZONE,
      currency: optional(formData, "currency"),
      travelers: travelers.length > 0 ? travelers : TRAVELER_IDS,
      accent: accentOrDefault(
        optional(formData, "accent"),
        nextAccent(existing.map((t) => t.accent)),
      ),
      notes: optional(formData, "notes"),
    })
    .returning({ slug: trips.slug });

  revalidatePath("/trips");
  redirect(`/t/${inserted[0].slug}/settings`);
}

export async function updateTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const trip = id ? await getTripById(id) : undefined;
  if (!trip) return { error: "That trip no longer exists." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the trip a name." };

  const startDate = isoDate(formData, "startDate");
  const endDate = isoDate(formData, "endDate");
  if (startDate && endDate && endDate < startDate) {
    return { error: "The trip ends before it starts." };
  }

  // Renaming shouldn't silently change the URL — a slug is only recomputed
  // when it's edited directly.
  const requested = optional(formData, "slug");
  const slug =
    requested && slugify(requested) !== trip.slug
      ? await uniqueSlug(requested, trip.id)
      : trip.slug;

  const travelers = whoList(formData, "travelers", TRAVELER_IDS);

  await getDb()
    .update(trips)
    .set({
      slug,
      name,
      destination: optional(formData, "destination"),
      emoji: firstEmoji(optional(formData, "emoji")),
      startDate,
      endDate,
      timezone: optional(formData, "timezone") ?? trip.timezone,
      currency: optional(formData, "currency"),
      travelers: travelers.length > 0 ? travelers : trip.travelers,
      accent: accentOrDefault(optional(formData, "accent"), trip.accent),
      notes: optional(formData, "notes"),
      updatedAt: new Date(),
    })
    .where(eq(trips.id, trip.id));

  revalidatePath("/trips");
  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/settings`);
  if (slug !== trip.slug) redirect(`/t/${slug}/settings`);
  return {};
}

/** Hide a finished trip from the switcher, keeping everything on it. */
export async function archiveTrip(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  if (!id) return;

  await getDb()
    .update(trips)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(trips.id, id));

  revalidatePath("/trips");
  revalidatePath("/", "layout");
}

/**
 * Delete a trip and everything on it.
 *
 * Guarded by typing the trip's name, because the cascade takes the bookings
 * with it and there is no undo.
 */
export async function deleteTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const trip = id ? await getTripById(id) : undefined;
  if (!trip) return { error: "That trip no longer exists." };

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed.toLowerCase() !== trip.name.trim().toLowerCase()) {
    return { error: `Type "${trip.name}" to confirm.` };
  }

  await getDb().delete(trips).where(eq(trips.id, trip.id));

  revalidatePath("/trips");
  redirect("/trips");
}

/* ------------------------------------------------------------------ legs */

export async function saveLeg(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tripId = String(formData.get("tripId") ?? "");
  const trip = tripId ? await getTripById(tripId) : undefined;
  if (!trip) return { error: "That trip no longer exists." };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give the leg a name." };

  const startDate = isoDate(formData, "startDate");
  const endDate = isoDate(formData, "endDate");
  if (startDate && endDate && endDate < startDate) {
    return { error: `"${label}" ends before it starts.` };
  }

  const id = optional(formData, "id");
  const travelers = whoList(formData, "travelers", EVERYONE_IDS);
  const position = Number(formData.get("position") ?? 0) || 0;

  const values = {
    label,
    place: optional(formData, "place"),
    timezone: optional(formData, "timezone") ?? trip.timezone,
    startDate,
    endDate,
    travelers,
    accent: accentOrDefault(optional(formData, "accent"), trip.accent),
    position,
  };

  if (id) {
    await getDb()
      .update(legs)
      .set(values)
      .where(and(eq(legs.id, id), eq(legs.tripId, trip.id)));
  } else {
    await getDb()
      .insert(legs)
      .values({
        ...values,
        tripId: trip.id,
        slug: await uniqueLegSlug(trip.id, label),
      });
  }

  revalidatePath(`/t/${trip.slug}`);
  revalidatePath(`/t/${trip.slug}/settings`);
  return {};
}

/** Leg slugs only have to be unique inside their own trip. */
async function uniqueLegSlug(tripId: string, label: string): Promise<string> {
  const base = slugify(label) || "leg";
  const rows = await getDb()
    .select({ slug: legs.slug })
    .from(legs)
    .where(eq(legs.tripId, tripId));
  const taken = new Set(rows.map((r) => r.slug));

  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export async function deleteLeg(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!id) return;

  // Segments referencing it fall back to matching on the date, because legId
  // is ON DELETE SET NULL rather than a cascade — deleting a leg must never
  // take bookings with it.
  await getDb().delete(legs).where(eq(legs.id, id));

  if (slug) {
    revalidatePath(`/t/${slug}`);
    revalidatePath(`/t/${slug}/settings`);
  }
}

/* ------------------------------------------------------------ milestones */

export async function saveMilestone(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tripId = String(formData.get("tripId") ?? "");
  const trip = tripId ? await getTripById(tripId) : undefined;
  if (!trip) return { error: "That trip no longer exists." };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give the milestone a name." };

  const date = isoDate(formData, "date");
  if (!date) return { error: "A milestone needs a date." };

  const id = optional(formData, "id");
  const values = {
    label,
    date,
    timezone: optional(formData, "timezone") ?? trip.timezone,
    who: whoList(formData, "who", EVERYONE_IDS),
    position: Number(formData.get("position") ?? 0) || 0,
  };

  if (id) {
    await getDb()
      .update(milestones)
      .set(values)
      .where(and(eq(milestones.id, id), eq(milestones.tripId, trip.id)));
  } else {
    await getDb()
      .insert(milestones)
      .values({ ...values, tripId: trip.id });
  }

  revalidatePath(`/t/${trip.slug}`);
  revalidatePath(`/t/${trip.slug}/settings`);
  return {};
}

export async function deleteMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("tripSlug") ?? "");
  if (!id) return;

  await getDb().delete(milestones).where(eq(milestones.id, id));

  if (slug) {
    revalidatePath(`/t/${slug}`);
    revalidatePath(`/t/${slug}/settings`);
  }
}
