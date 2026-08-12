import Link from "next/link";

import { logout } from "@/app/actions";

/**
 * Built for a phone first. There is no separate "Timeline" link — the wordmark
 * goes home, which is the usual convention and buys back the width that made
 * the bar overflow on a narrow screen. Every target is at least 44px tall.
 */
export function Nav({ pendingCount }: { pendingCount: number }) {
  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-3 py-2 sm:px-4">
        <Link
          href="/"
          className="mr-auto flex min-h-11 items-center pr-2 text-base font-semibold tracking-tight"
        >
          Trip HQ
        </Link>

        <Link
          href="/inbox"
          className="flex min-h-11 items-center rounded-lg px-2.5 text-sm text-muted transition hover:bg-stone-100 hover:text-foreground"
        >
          Review
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {pendingCount}
            </span>
          )}
        </Link>

        <Link
          href="/add"
          className="flex min-h-11 items-center rounded-lg bg-stone-900 px-3 text-sm font-medium text-white transition hover:bg-stone-700"
        >
          Add
        </Link>

        <form action={logout} className="flex">
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex min-h-11 items-center rounded-lg px-2 text-sm text-muted transition hover:bg-stone-100 hover:text-foreground"
          >
            {/* The word costs more width than it earns on a phone. */}
            <span className="hidden sm:inline">Sign out</span>
            <span aria-hidden className="sm:hidden">
              ⏻
            </span>
          </button>
        </form>
      </div>
    </header>
  );
}
