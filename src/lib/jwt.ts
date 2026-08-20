import { SignJWT, jwtVerify } from "jose";

export const TOKEN_TTL_SECONDS = 60 * 60 * 24;

const SECRET = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;

export type UserTokenPayload = {
  name: string;
  email: string;
  image: string | null;
};

function encodedSecret(): Uint8Array {
  if (!SECRET) {
    throw new Error("JWT_SECRET is not defined. Copy .env.example to .env and fill it in.");
  }
  return new TextEncoder().encode(SECRET);
}

export async function mintUserToken(payload: UserTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.email)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL_SECONDS)
    .sign(encodedSecret());
}

export async function verifyUserToken(
  token: string
): Promise<UserTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret(), {
      algorithms: ["HS256"],
    });
    const { name, email, image } = payload;
    if (typeof email !== "string" || typeof name !== "string") {
      return null;
    }
    return { name, email, image: typeof image === "string" ? image : null };
  } catch {
    return null;
  }
}
