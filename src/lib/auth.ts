/**
 * Shared-passcode auth. Two people, one passcode, one signed cookie.
 *
 * Uses Web Crypto rather than node:crypto so the same helpers run in
 * middleware (edge runtime) and in server actions.
 */

const encoder = new TextEncoder();

export const SESSION_COOKIE = "trip_session";
/** 60 days — long enough that nobody re-enters the passcode mid-trip. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60;

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 16 characters.",
    );
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The explicit ArrayBuffer parameter keeps this assignable to BufferSource,
// which SharedArrayBuffer-backed views are not.
function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(requireSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Mint a cookie value that expires SESSION_MAX_AGE from now. */
export async function createSessionToken(): Promise<string> {
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }),
    ),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    encoder.encode(payload),
  );
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** True only for a well-formed, correctly signed, unexpired token. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let valid = false;
  try {
    // subtle.verify is constant-time, so this doubles as the timing-safe compare.
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      base64UrlDecode(signature),
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
  if (!valid) return false;

  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return (
      typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

/** Length-independent comparison so a wrong passcode leaks no timing signal. */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // Compare a fixed-size digest-ish window; differing lengths still fail.
  let mismatch = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i += 1) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

/**
 * Secrets routinely pick up a trailing newline on the way into a hosting
 * provider (piping a file into `vercel env add` does exactly that), and a
 * passcode or token was never meant to have surrounding whitespace. Trim both
 * sides of the comparison so that can't silently lock anyone out.
 */
function expectedSecret(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function checkPasscode(input: string): boolean {
  const expected = expectedSecret("APP_PASSCODE");
  if (!expected) {
    throw new Error("APP_PASSCODE is not set.");
  }
  return safeEqual(input.trim(), expected);
}

/**
 * Auth for the inbound-email webhook, which can't carry the session cookie.
 * The secret may arrive as `?token=` or an `x-webhook-token` header, so it
 * works with providers that only let you customise the URL.
 */
export function checkWebhookSecret(request: Request): boolean {
  const expected = expectedSecret("INBOUND_WEBHOOK_SECRET");
  if (!expected) return false;

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  const fromHeader = request.headers.get("x-webhook-token");

  const provided = fromQuery ?? fromHeader;
  if (!provided) return false;
  return safeEqual(provided.trim(), expected);
}
