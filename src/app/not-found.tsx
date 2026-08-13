import Link from "next/link";

/**
 * Next's built-in error page carries its own dark-mode styling, which would be
 * the one dark screen in an otherwise light app. This replaces it.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page isn&apos;t part of the trip — the segment may have been
        deleted.
      </p>
      <div className="mt-6">
        <Link href="/" className="btn-primary">
          Back to the timeline
        </Link>
      </div>
    </main>
  );
}
