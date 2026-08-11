import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import { TRAVELERS } from "@/lib/config";
import { KIND_IDS } from "@/lib/kinds";

/**
 * Turns a forwarded booking confirmation into structured segments.
 *
 * The model returns wall-clock local times plus an IANA zone rather than UTC
 * instants — confirmation emails state local times, and converting them here
 * with a real timezone database is far more reliable than asking the model to
 * do the offset arithmetic.
 */

const ParsedSegmentSchema = z.object({
  kind: z
    .enum(["flight", "train", "hotel", "car", "ferry", "activity", "note"])
    .describe("The type of booking this segment represents."),
  title: z
    .string()
    .describe(
      "Short human label, e.g. 'BA 286 SFO → LHR' or 'The Hoxton, Shoreditch'.",
    ),
  vendor: z
    .string()
    .nullable()
    .describe("Airline, hotel brand, or rental company. Null if unclear."),
  confirmation: z
    .string()
    .nullable()
    .describe("Booking reference / PNR / confirmation number."),
  startLocal: z
    .string()
    .nullable()
    .describe(
      "Start as local wall-clock time in 'YYYY-MM-DDTHH:mm' form. For a " +
        "flight this is departure; for a hotel, check-in. Null if absent.",
    ),
  startTz: z
    .string()
    .nullable()
    .describe(
      "IANA timezone for startLocal, e.g. 'Europe/London'. Infer from the " +
        "departure airport or the property's city.",
    ),
  endLocal: z
    .string()
    .nullable()
    .describe(
      "End as local wall-clock time in 'YYYY-MM-DDTHH:mm' form. Arrival for " +
        "a flight, check-out for a hotel. Null if absent.",
    ),
  endTz: z
    .string()
    .nullable()
    .describe("IANA timezone for endLocal — the arrival city's zone."),
  fromLabel: z
    .string()
    .nullable()
    .describe("Origin: airport/station code or pick-up location."),
  toLabel: z
    .string()
    .nullable()
    .describe("Destination: airport/station code or drop-off location."),
  address: z
    .string()
    .nullable()
    .describe("Street address, for stays and activities."),
  travelers: z
    .array(z.enum(["xiao", "husband"]))
    .describe(
      "Which travelers this booking covers, matched by the names given in " +
        "the system prompt. Use both ids when the booking names both or is " +
        "ambiguous.",
    ),
  costAmount: z
    .string()
    .nullable()
    .describe("Total cost as digits only, e.g. '842.50'."),
  costCurrency: z
    .string()
    .nullable()
    .describe("ISO currency code, e.g. 'GBP'."),
  notes: z
    .string()
    .nullable()
    .describe("Anything useful that has no other field: seat, room type, " +
      "baggage allowance, cancellation policy."),
  details: z
    .array(
      z.object({
        label: z.string().describe("Field name, e.g. 'Flight number'."),
        value: z.string().describe("Field value, e.g. 'BA286'."),
      }),
    )
    .describe("Extra structured facts worth showing on the detail view."),
});

const ExtractionSchema = z.object({
  isBooking: z
    .boolean()
    .describe(
      "True if the email contains at least one travel booking. False for " +
        "marketing, newsletters, or unrelated mail.",
    ),
  summary: z
    .string()
    .describe("One sentence describing what this email contained."),
  segments: z
    .array(ParsedSegmentSchema)
    .describe(
      "One entry per distinct bookable item. A round-trip itinerary produces " +
        "two flight segments, not one.",
    ),
});

export type ParsedSegment = z.infer<typeof ParsedSegmentSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Emails above this size are almost always quoted threads or HTML noise. */
const MAX_BODY_CHARS = 120_000;

const travelerRoster = TRAVELERS.map(
  (t) => `- id "${t.id}" — ${t.name}`,
).join("\n");

const SYSTEM_PROMPT = `You extract travel bookings from forwarded confirmation emails for a two-person trip planner.

The travelers are:
${travelerRoster}

Guidelines:
- Produce one segment per distinct bookable item. A round trip is two flights; a multi-city hotel booking with two properties is two stays.
- Valid segment kinds are: ${KIND_IDS.join(", ")}.
- Report times exactly as the email states them, as local wall-clock values, and name the IANA timezone separately. Do not convert between zones yourself.
- When a flight crosses timezones, startTz is the departure airport's zone and endTz is the arrival airport's zone.
- Leave a field null when the email does not state it. Do not guess a confirmation number, price, or address.
- If the email is not a travel booking, set isBooking to false and return an empty segments array.`;

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ParseInput {
  subject: string | null;
  fromAddress: string | null;
  body: string;
  /** Raw HTML part, used when the text part is missing or empty. */
  html?: string | null;
}

export interface ParseResult {
  extraction: Extraction;
  /** Set when the body was too long and only the head was sent to the model. */
  truncated: boolean;
}

export async function parseBookingEmail(
  input: ParseInput,
): Promise<ParseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic();

  const rawBody = input.body?.trim()
    ? input.body
    : stripHtml(input.html ?? "");
  const cleaned = /<[a-z][\s\S]*>/i.test(rawBody) ? stripHtml(rawBody) : rawBody;

  const truncated = cleaned.length > MAX_BODY_CHARS;
  const body = truncated ? cleaned.slice(0, MAX_BODY_CHARS) : cleaned;

  // Today's date goes in the user turn, not the system prompt, so the cached
  // system prefix stays byte-identical across requests.
  const userContent = [
    `Today's date is ${new Date().toISOString().slice(0, 10)}. Use it only to`,
    `resolve years that the email leaves implicit.`,
    ``,
    `From: ${input.fromAddress ?? "unknown"}`,
    `Subject: ${input.subject ?? "(no subject)"}`,
    ``,
    truncated
      ? "NOTE: this email was truncated; extract what is present."
      : "",
    ``,
    body,
  ].join("\n");

  const message = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(ExtractionSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to process this email.");
  }
  if (!message.parsed_output) {
    throw new Error("The model returned no parseable output.");
  }

  return { extraction: message.parsed_output, truncated };
}
