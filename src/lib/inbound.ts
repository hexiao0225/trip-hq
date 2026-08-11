import "server-only";

/**
 * Normalises inbound-email webhooks into one shape.
 *
 * Kept provider-agnostic on purpose: Postmark, Resend, SendGrid and a
 * Cloudflare Email Worker all post different JSON, and the choice of provider
 * shouldn't require a code change.
 */

export interface NormalizedEmail {
  provider: string;
  externalId: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  subject: string | null;
  text: string;
  html: string | null;
  receivedAt: Date;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Resend sends `to` as an array; Postmark as a comma-joined string. */
function normalizeRecipient(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : typeof entry === "object" && entry !== null
            ? String((entry as Record<string, unknown>).Email ?? "")
            : "",
      )
      .filter(Boolean)
      .join(", ");
    return joined || null;
  }
  return firstString(value);
}

function parseDate(value: unknown): Date {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

type Payload = Record<string, unknown>;

export function normalizeJsonPayload(payload: Payload): NormalizedEmail {
  // Postmark: capitalised keys, TextBody/HtmlBody.
  if ("TextBody" in payload || "HtmlBody" in payload || "FromFull" in payload) {
    const fromFull = payload.FromFull as Payload | undefined;
    return {
      provider: "postmark",
      externalId: firstString(payload.MessageID),
      fromAddress: firstString(fromFull?.Email, payload.From),
      toAddress: firstString(payload.OriginalRecipient, payload.To),
      subject: firstString(payload.Subject),
      text: firstString(payload.TextBody) ?? "",
      html: firstString(payload.HtmlBody),
      receivedAt: parseDate(payload.Date),
    };
  }

  // Resend: event envelope with the message under `data`.
  const data = payload.data as Payload | undefined;
  if (data && typeof payload.type === "string") {
    return {
      provider: "resend",
      externalId: firstString(data.email_id, payload.id),
      fromAddress: firstString(data.from),
      toAddress: normalizeRecipient(data.to),
      subject: firstString(data.subject),
      text: firstString(data.text) ?? "",
      html: firstString(data.html),
      receivedAt: parseDate(data.created_at ?? payload.created_at),
    };
  }

  // Generic lowercase shape — Cloudflare Email Workers and hand-rolled posts.
  return {
    provider: firstString(payload.provider) ?? "generic",
    externalId: firstString(payload.messageId, payload.message_id, payload.id),
    fromAddress: firstString(payload.from, payload.sender),
    toAddress: normalizeRecipient(payload.to ?? payload.recipient),
    subject: firstString(payload.subject),
    text: firstString(payload.text, payload.body, payload.plain) ?? "",
    html: firstString(payload.html),
    receivedAt: parseDate(payload.date ?? payload.receivedAt),
  };
}

/** SendGrid Inbound Parse posts multipart/form-data rather than JSON. */
export function normalizeFormPayload(form: FormData): NormalizedEmail {
  const get = (key: string): string | null => {
    const value = form.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  return {
    provider: "sendgrid",
    externalId: null,
    fromAddress: get("from"),
    toAddress: get("to"),
    subject: get("subject"),
    text: get("text") ?? "",
    html: get("html"),
    receivedAt: new Date(),
  };
}

export async function normalizeRequest(
  request: Request,
): Promise<NormalizedEmail> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return normalizeFormPayload(await request.formData());
  }

  const payload = (await request.json()) as Payload;
  return normalizeJsonPayload(payload);
}
