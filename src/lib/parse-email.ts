import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import { PETS, TRAVELERS } from "@/lib/config";
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
    .enum([
      "flight",
      "train",
      "hotel",
      "car",
      "ferry",
      "activity",
      "dining",
      "pet",
      "note",
    ])
    .describe(
      "The type of booking this segment represents. Use 'dining' for a table " +
        "at a restaurant, bar, or cafe, including afternoon tea. Use " +
        "'activity' for anything else you attend — a show, tour, museum " +
        "ticket, or class. Use 'pet' for dog boarding, sitting, daycare, or a " +
        "vet appointment.",
    ),
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
  fromCity: z
    .string()
    .nullable()
    .describe(
      "City the journey starts in, in plain English — 'San Francisco', " +
        "'London', 'Beijing'. Give the city even when the email only prints " +
        "an airport code, and use the city rather than the airport's name.",
    ),
  toCity: z
    .string()
    .nullable()
    .describe("City the journey ends in, same convention as fromCity."),
  address: z
    .string()
    .nullable()
    .describe("Street address, for stays and activities."),
  travelers: z
    .array(z.enum(["xiao", "hanyang", "zero", "totoro"]))
    .describe(
      "Who this booking covers, matched by the names given in the system " +
        "prompt. Use both people when the booking names both or is ambiguous. " +
        "A pet booking covers the dogs it names, and no people.",
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
  tripSlug: z
    .string()
    .nullable()
    .describe(
      "The slug of the trip these bookings belong to, chosen from the trips " +
        "listed in the system prompt — matched on dates first, then on " +
        "destination. Null if none of them fits or the email is ambiguous; a " +
        "wrong guess is worse than none, because unmatched bookings are filed " +
        "by hand rather than lost.",
    ),
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

const petRoster = PETS.map((p) => `- id "${p.id}" — ${p.name}`).join("\n");

/** The trips a forwarded booking could belong to, as the model sees them. */
export interface TripOption {
  slug: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
}

function tripRoster(trips: TripOption[]): string {
  if (trips.length === 0) {
    return "No trips exist yet, so always return null for tripSlug.";
  }
  return trips
    .map((trip) => {
      const dates =
        trip.startDate && trip.endDate
          ? `${trip.startDate} to ${trip.endDate}`
          : (trip.startDate ?? trip.endDate ?? "dates not set");
      const where = trip.destination ? ` — ${trip.destination}` : "";
      return `- slug "${trip.slug}" — ${trip.name}${where} (${dates})`;
    })
    .join("\n");
}

/**
 * Built per request rather than once at module load, because the trips are
 * rows now. The roster changes only when a trip is added, so the cached prefix
 * still holds across the long runs of emails forwarded for one trip.
 */
function systemPrompt(trips: TripOption[]): string {
  return `You extract travel bookings from forwarded confirmation emails for a household trip planner.

The travelers are:
${travelerRoster}

They also have two dogs, who stay behind and have their own boarding and vet arrangements:
${petRoster}

The trips currently being planned are:
${tripRoster(trips)}

Guidelines:
- Produce one segment per distinct bookable item. A round trip is two flights; a multi-city hotel booking with two properties is two stays.
- Valid segment kinds are: ${KIND_IDS.join(", ")}.
- Report times exactly as the email states them, as local wall-clock values, and name the IANA timezone separately. Do not convert between zones yourself.
- When a flight crosses timezones, startTz is the departure airport's zone and endTz is the arrival airport's zone.
- Decide which trip the email belongs to and return its slug. Dates are the strongest signal, destination the next; a dog's boarding booking belongs to whichever trip it covers the household for. Return null rather than guessing.
- Leave a field null when the email does not state it. Do not guess a confirmation number, price, or address.
- If the email is not a travel booking, set isBooking to false and return an empty segments array.`;
}

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
  /** Trips the booking could be filed under. */
  trips: TripOption[];
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
    system: systemPrompt(input.trips),
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
