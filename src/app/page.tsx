import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/home");
  }
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[#0a0e13] px-6 text-slate-200">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          NIFTY 50 · Institutional Flow Terminal
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">
          Daily NIFTY analytics with FII / DII flows
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Sign in with Google to view the candlestick terminal and
          institutional activity data.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton />
        </div>
      </div>
    </main>
  );
}
