"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPasscode,
  createSessionToken,
} from "@/lib/auth";
import { TRAVELER_IDS } from "@/lib/config";
import { getDb } from "@/lib/db";
import { segments } from "@/lib/db/schema";
import { processEmail } from "@/lib/ingest";
import { KIND_IDS } from "@/lib/kinds";
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
    .filter((id) => TRAVELER_IDS.includes(id));
}

function optional(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

export async function saveSegment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = optional(formData, "id");

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

  const values = {
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
    leg: optional(formData, "leg"),
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

  revalidatePath("/");
  revalidatePath("/inbox");
  redirect("/");
}

export async function deleteSegment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await getDb().delete(segments).where(eq(segments.id, id));
  revalidatePath("/");
  revalidatePath("/inbox");
  redirect("/");
}

/** Move an email-parsed segment out of the review queue and onto the timeline. */
export async function confirmSegment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await getDb()
    .update(segments)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(segments.id, id));
  revalidatePath("/");
  revalidatePath("/inbox");
}

export async function discardSegment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await getDb().delete(segments).where(eq(segments.id, id));
  revalidatePath("/inbox");
}

/** Re-run the model over a stored email after a failed or poor parse. */
export async function reparseEmail(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await processEmail(id);
  } catch (error) {
    console.error("Re-parse failed", id, error);
  }
  revalidatePath("/inbox");
}
