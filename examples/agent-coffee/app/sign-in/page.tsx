"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, useSession } from "@/lib/auth-client";

export default function SignInPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session && !isPending) router.push("/dashboard");
  }, [session, isPending, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res =
        mode === "signup"
          ? await signUp.email({ email, password, name })
          : await signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? "Failed");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleSiws() {
    type PhantomProvider = {
      connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
      signMessage: (m: Uint8Array, enc: string) => Promise<{ signature: Uint8Array }>;
    };
    const provider = (window as unknown as { solana?: PhantomProvider }).solana;
    if (!provider) {
      setError("Phantom wallet not found. Install Phantom to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { publicKey } = await provider.connect();
      const address = publicKey.toBase58();
      const nonce = Math.random().toString(36).slice(2, 18);
      const message = `Sign in to Agent Coffee Shop\n\nAddress: ${address}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
      const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
      const res = await fetch("/api/auth/sign-in/siws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature: btoa(String.fromCharCode(...signature)),
          message,
          nonce,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setError(err.message ?? "SIWS sign-in failed");
      } else {
        router.push("/dashboard");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "SIWS sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  if (isPending) return null;

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl">☕</span>
          <h1 className="text-[17px] font-semibold tracking-tight mt-2">Agent Coffee Shop</h1>
          <p className="text-[13px] text-foreground/45 mt-1">
            Sign in to track your orders and manage agents.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              required
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border placeholder:text-foreground/25 text-[13px] outline-none focus:border-foreground/20"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border placeholder:text-foreground/25 text-[13px] outline-none focus:border-foreground/20"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={8}
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border placeholder:text-foreground/25 text-[13px] outline-none focus:border-foreground/20"
          />
          {error && <p className="text-[12px] text-red-500 px-1">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-[13px] font-medium rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="px-2 bg-background text-foreground/30">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSiws}
          disabled={loading}
          className="w-full py-2.5 text-[13px] font-medium rounded-lg border border-[#9945FF]/40 text-[#9945FF] hover:bg-[#9945FF]/5 disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <title>Solana</title>
            <circle cx="16" cy="16" r="15" stroke="#9945FF" strokeWidth="2" />
            <path
              d="M8 20 L12 12 L16 18 L20 10 L24 20"
              stroke="#14F195"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Connect Solana Wallet
        </button>

        <p className="mt-4 text-center text-[12px] text-foreground/40">
          {mode === "signin" ? "No account?" : "Already have one?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="underline cursor-pointer"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
