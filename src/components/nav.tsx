import Link from "next/link";

import { logout } from "@/app/actions";

export function Nav({ pendingCount }: { pendingCount: number }) {
  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-auto text-base font-semibold tracking-tight">
          Trip HQ
        </Link>

        <Link
          href="/"
          className="rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-stone-100 hover:text-foreground"
        >
          Timeline
        </Link>

        <Link
          href="/inbox"
          className="relative rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-stone-100 hover:text-foreground"
        >
          Review
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {pendingCount}
            </span>
          )}
        </Link>

        <Link href="/add" className="btn-primary ml-1">
          Add
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-stone-100 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
