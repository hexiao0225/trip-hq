import { after } from "next/server";

import { checkWebhookSecret } from "@/lib/auth";
import { processEmail, storeEmail } from "@/lib/ingest";
import { normalizeRequest } from "@/lib/inbound";

/**
 * Inbound-email webhook.
 *
 * Providers time out in seconds but the model call can take much longer, so
 * this stores the email, acknowledges immediately, and parses in `after()`.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!checkWebhookSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let stored: { id: string; duplicate: boolean };
  try {
    const email = await normalizeRequest(request);
    if (!email.text && !email.html) {
      return Response.json({ error: "Email had no body" }, { status: 400 });
    }
    stored = await storeEmail(email);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the payload";
    return Response.json({ error: message }, { status: 400 });
  }

  // A redelivery of the same message shouldn't re-run the parse.
  if (stored.duplicate) {
    return Response.json({ ok: true, id: stored.id, duplicate: true });
  }

  after(async () => {
    try {
      await processEmail(stored.id);
    } catch (error) {
      // processEmail has already recorded the failure on the email row; the
      // review screen surfaces it with a retry button.
      console.error("Failed to parse inbound email", stored.id, error);
    }
  });

  return Response.json({ ok: true, id: stored.id });
}

/** Lets you confirm the endpoint and secret are wired up from a browser. */
export async function GET(request: Request) {
  if (!checkWebhookSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true, message: "Inbound email endpoint is live." });
}
