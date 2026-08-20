import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import NiftyTerminal from "@/components/nifty-terminal";
import { SignedInBar } from "@/components/signed-in-bar";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  return (
    <div className="flex h-screen flex-col bg-[#0a0e13]">
      <SignedInBar />
      <div className="min-h-0 flex-1">
        <NiftyTerminal />
      </div>
    </div>
  );
}
