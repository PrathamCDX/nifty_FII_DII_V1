import { auth } from "@/lib/auth";
import { upsertGoogleUser } from "@/lib/user";
import { mintUserToken, TOKEN_TTL_SECONDS } from "@/lib/jwt";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentIdempotencyKey = Number(request.headers.get("Idempotency-Key") ?? "0");
  const googleId = user.id ?? user.email;
  await upsertGoogleUser({
    email: user.email,
    name: user.name ?? user.email,
    image: user.image ?? null,
    googleId,
  }, currentIdempotencyKey);

  const token = await mintUserToken({
    name: user.name ?? user.email,
    email: user.email,
    image: user.image ?? null,
  });

  return Response.json({
    token,
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    user: { name: user.name ?? user.email, email: user.email, image: user.image ?? null },
  });
}
