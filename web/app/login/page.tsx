import { LoginForm } from "@/components/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">
          Cooltra Reporting Platform
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Introdueix el password per accedir.
        </p>
        <div className="mt-6">
          <LoginForm next={next?.trim() || "/"} />
        </div>
      </div>
    </div>
  );
}
