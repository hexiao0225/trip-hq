import { LoginForm } from "@/components/login-form";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "/";
  return value ?? "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Trip HQ</h1>
      <p className="mt-1 text-sm text-muted">
        London, Scotland, the residency, and the way home.
      </p>
      <LoginForm next={firstParam(params.next)} />
    </main>
  );
}
