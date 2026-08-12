import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { inboundEmails, segments, type NewSegment } from "@/lib/db/schema";
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
    travelers: parsed.travelers.length ? parsed.travelers : ["xiao", "husband"],
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

    if (newRows.length > 0) {
      await getDb().insert(segments).values(newRows);
    }

    await getDb()
      .update(inboundEmails)
      .set({
        parseStatus: "parsed",
        parseError: truncated
          ? "Email was long and only the first part was read."
          : null,
        segmentCount: String(newRows.length),
      })
      .where(eq(inboundEmails.id, emailId));

    return newRows.length;
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
