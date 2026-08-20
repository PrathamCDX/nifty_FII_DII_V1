"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { signOut } from "next-auth/react";

export const TOKEN_STORAGE_KEY = "niftyfd_token";

type TokenResponse = {
  token: string;
  expiresAt: number;
  user: { name: string; email: string; image: string | null };
};

async function fetchToken(): Promise<TokenResponse> {
  const response = await axios.get<TokenResponse>("/api/auth/jwt");
  return response.data;
}

export function SignedInBar() {
  const [user, setUser] = useState<TokenResponse["user"] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetchToken()
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        setUser(data.user);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    await signOut({ callbackUrl: "/" });
  }

  if (status === "loading") {
    return (
      <div className="flex h-9 items-center justify-end gap-3 px-5 text-[11px] text-slate-500">
        Loading session…
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center justify-end gap-3 px-5 text-[11px] text-slate-400">
      {status === "error" || !user ? (
        <span className="text-slate-500">Session unavailable</span>
      ) : (
        <span className="flex items-center gap-2">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name}
              className="h-5 w-5 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <span>{user.name}</span>
          <span className="text-slate-600">{user.email}</span>
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-white/5"
      >
        Sign out
      </button>
    </div>
  );
}
