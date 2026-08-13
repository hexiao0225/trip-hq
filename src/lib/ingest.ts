import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  inboundEmails,
  segments,
  type NewSegment,
  type Segment,
} from "@/lib/db/schema";
import type { NormalizedEmail } from "@/lib/inbound";
import { parseBookingEmail, type ParsedSegment } from "@/lib/parse-email";
import { localInputToDate } from "@/lib/time";

/**
 * Store the raw email first, then parse. Persisting before the model call means
 * a parse failure never loses the booking — it can be retried from the UI.
 */
export async function storeEmail(
  email: NormalizedEmail,
): Promise<{ id: string; duplicate: boolean }> {
  if (email.externalId) {
    const existing = await getDb()
      .select({ id: inboundEmails.id })
      .from(inboundEmails)
      .where(eq(inboundEmails.externalId, email.externalId))
      .limit(1);
    if (existing[0]) return { id: existing[0].id, duplicate: true };
  }

  const body = email.text.trim() ? email.text : (email.html ?? "");

  const inserted = await getDb()
    .insert(inboundEmails)
    .values({
      provider: email.provider,
      externalId: email.externalId,
      fromAddress: email.fromAddress,
      toAddress: email.toAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      body,
      parseStatus: "pending",
    })
    .returning({ id: inboundEmails.id });

  return { id: inserted[0].id, duplicate: false };
}

/** Map one model-extracted segment onto a database row. */
function toSegmentRow(
  parsed: ParsedSegment,
  emailId: string,
): NewSegment | null {
  const startTz = parsed.startTz || "UTC";
  const endTz = parsed.endTz || startTz;

  const startAt = localInputToDate(parsed.startLocal, startTz);
  const endAt = localInputToDate(parsed.endLocal, endTz);

  // A segment with neither a time nor a title isn't worth reviewing.
  if (!startAt && !parsed.title) return null;

  const details: Record<string, string> = {};
  for (const item of parsed.details) {
    if (item.label && item.value) details[item.label] = item.value;
  }

  return {
    kind: parsed.kind,
    title: parsed.title,
    vendor: parsed.vendor,
    confirmation: parsed.confirmation,
    startAt,
    startTz,
    endAt,
    endTz: endAt ? endTz : null,
    fromLabel: parsed.fromLabel,
    toLabel: parsed.toLabel,
    fromCity: parsed.fromCity,
    toCity: parsed.toCity,
    address: parsed.address,
    travelers: parsed.travelers.length ? parsed.travelers : ["xiao", "hanyang"],
    leg: null,
    // Everything from email lands in the review queue rather than the timeline.
    status: "pending",
    costAmount: parsed.costAmount,
    costCurrency: parsed.costCurrency,
    notes: parsed.notes,
    source: "email",
    sourceEmailId: emailId,
    details,
  };
}

/**
 * An airline typically sends the itinerary and the receipt as two separate
 * emails for one booking, so forwarding both would otherwise put the same
 * flight on the timeline twice.
 *
 * Both the confirmation number and the exact departure instant have to match:
 * a confirmation alone is not enough, because a round trip shares one
 * reference across its legs.
 */
async function findDuplicate(row: NewSegment): Promise<Segment | undefined> {
  const reference = row.confirmation?.trim();
  if (!reference || !row.startAt) return undefined;

  const matches = await getDb()
    .select()
    .from(segments)
    .where(
      and(
        sql`lower(trim(${segments.confirmation})) = ${reference.toLowerCase()}`,
        eq(segments.startAt, row.startAt),
      ),
    )
    .limit(1);

  return matches[0];
}

/**
 * The two emails usually carry different details — the receipt has the fare the
 * itinerary lacked — so fill the gaps on the row we already have rather than
 * overwriting it. Never touches a field that already has a value, so anything
 * edited by hand survives.
 */
function enrichment(existing: Segment, incoming: NewSegment) {
  const patch: Partial<NewSegment> = {};

  if (!existing.vendor && incoming.vendor) patch.vendor = incoming.vendor;
  if (!existing.fromLabel && incoming.fromLabel)
    patch.fromLabel = incoming.fromLabel;
  if (!existing.toLabel && incoming.toLabel) patch.toLabel = incoming.toLabel;
  if (!existing.fromCity && incoming.fromCity)
    patch.fromCity = incoming.fromCity;
  if (!existing.toCity && incoming.toCity) patch.toCity = incoming.toCity;
  if (!existing.address && incoming.address) patch.address = incoming.address;
  if (!existing.costAmount && incoming.costAmount)
    patch.costAmount = incoming.costAmount;
  if (!existing.costCurrency && incoming.costCurrency)
    patch.costCurrency = incoming.costCurrency;
  if (!existing.notes && incoming.notes) patch.notes = incoming.notes;
  if (!existing.link && incoming.link) patch.link = incoming.link;

  // Existing detail values win on conflict, but new keys are added.
  const details = { ...incoming.details, ...existing.details };
  if (Object.keys(details).length > Object.keys(existing.details).length) {
    patch.details = details;
  }

  return patch;
}

/**
 * Run the model over a stored email and insert the segments it finds.
 * Safe to call again for the same email — prior rows from it are replaced.
 */
export async function processEmail(emailId: string): Promise<number> {
  const rows = await getDb()
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.id, emailId))
    .limit(1);

  const email = rows[0];
  if (!email) throw new Error(`No stored email with id ${emailId}`);

  try {
    const { extraction, truncated } = await parseBookingEmail({
      subject: email.subject,
      fromAddress: email.fromAddress,
      body: email.body,
    });

    if (!extraction.isBooking || extraction.segments.length === 0) {
      await getDb()
        .update(inboundEmails)
        .set({
          parseStatus: "ignored",
          parseError: extraction.summary,
          segmentCount: "0",
        })
        .where(eq(inboundEmails.id, emailId));
      return 0;
    }

    const newRows = extraction.segments
      .map((parsed) => toSegmentRow(parsed, emailId))
      .filter((row): row is NewSegment => row !== null);

    // Clear anything a previous run of this email produced, so a re-parse
    // replaces its results instead of duplicating them.
    await getDb().delete(segments).where(eq(segments.sourceEmailId, emailId));

    let created = 0;
    let merged = 0;

    for (const row of newRows) {
      const existing = await findDuplicate(row);

      if (existing) {
        const patch = enrichment(existing, row);
        if (Object.keys(patch).length > 0) {
          await getDb()
            .update(segments)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(segments.id, existing.id));
        }
        merged += 1;
      } else {
        await getDb().insert(segments).values(row);
        created += 1;
      }
    }

    const notes: string[] = [];
    if (truncated) {
      notes.push("Email was long and only the first part was read.");
    }
    if (merged > 0) {
      notes.push(
        `${merged} booking${merged === 1 ? "" : "s"} already on the trip; ` +
          "filled in any missing details rather than adding a duplicate.",
      );
    }

    await getDb()
      .update(inboundEmails)
      .set({
        parseStatus: "parsed",
        parseError: notes.length > 0 ? notes.join(" ") : null,
        segmentCount: String(created),
      })
      .where(eq(inboundEmails.id, emailId));

    return created;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown parse error";
    await getDb()
      .update(inboundEmails)
      .set({ parseStatus: "failed", parseError: messageText })
      .where(eq(inboundEmails.id, emailId));
    throw error;
  }
}
