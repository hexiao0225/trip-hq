/**
 * Shown instead of a stack trace when the app is running without its
 * environment configured — which is the state it's in right after cloning.
 */
export function SetupNotice({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Something isn't configured yet.";

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-semibold">Finish setting up Trip HQ</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>

      <div className="mt-6 rounded-xl border border-edge bg-surface p-4">
        <p className="text-sm font-medium">Checklist</p>
        <ol className="mt-2 space-y-2 text-sm text-muted">
          <li>
            1. Create a Postgres database (Neon&apos;s free tier works) and copy
            its connection string.
          </li>
          <li>
            2. Copy <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code> and fill in the values.
          </li>
          <li>
            3. Run <code className="font-mono">npm run db:push</code> to create
            the tables.
          </li>
          <li>
            4. Restart <code className="font-mono">npm run dev</code>.
          </li>
        </ol>
      </div>
    </main>
  );
}
