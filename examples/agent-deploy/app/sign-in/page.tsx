"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AgentAuthLogo } from "@/components/icons/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { signIn, useSession } from "@/lib/auth-client";

const FEATURES = [
  {
    title: "Deploy in seconds",
    description:
      "Create live HTML sites instantly. Each deployment gets a unique URL you can share with anyone.",
  },
  {
    title: "AI agent powered",
    description:
      "Let AI agents deploy, update, and manage sites on your behalf through the Agent Auth Protocol.",
  },
  {
    title: "Capability-based access",
    description:
      "Fine-grained permissions let you control exactly what each agent can do. Approve or deny at any time.",
  },
];

export default function SignInPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      router.replace("/dashboard");
    }
  }, [session, isPending, router]);

  if (isPending || session) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-4 w-4 rounded-full border-2 border-foreground/10 border-t-foreground/60 animate-spin" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Invalid credentials");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
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
      const message = `Sign in to Agent Deploy\n\nAddress: ${address}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
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

  return (
    <div className="min-h-dvh flex">
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] shrink-0 flex-col justify-between bg-foreground text-background p-10">
        <div>
          <div className="flex items-center gap-2">
            <AgentAuthLogo className="h-3.5 w-auto invert dark:invert-0" />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-30"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[12px] font-semibold tracking-wide opacity-60">Deploy</span>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-2.5">
            <h2 className="text-[22px] font-semibold tracking-tight leading-tight">
              Deploy HTML sites
              <br />
              with AI agents
            </h2>
            <p className="text-[13px] opacity-40 leading-relaxed max-w-sm">
              A deployment platform powered by the Agent Auth Protocol. Manage sites from the
              dashboard or let AI agents handle it autonomously.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-2.5">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-background/10 flex items-center justify-center shrink-0">
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-medium">{feature.title}</p>
                  <p className="text-[11px] opacity-35 leading-relaxed mt-0.5">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/nicepkg/agent-auth"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] opacity-30 hover:opacity-50 transition-opacity"
          >
            GitHub
          </a>
          <a
            href="https://agent-auth.better-auth.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] opacity-30 hover:opacity-50 transition-opacity"
          >
            Docs
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="lg:hidden flex items-center gap-2">
            <AgentAuthLogo className="h-3.5 w-auto" />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-foreground/20"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[12px] font-semibold tracking-wide text-foreground/50">
              Deploy
            </span>
          </div>
          <div className="lg:ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h1 className="text-[22px] font-semibold tracking-tight">Welcome back</h1>
                <p className="text-[13px] text-foreground/40">
                  Sign in to your account to manage deployments and agents.
                </p>
              </div>

              <div className="lg:hidden flex items-center gap-2.5 p-3 rounded-md border border-border bg-foreground/2">
                <div className="h-7 w-7 rounded-md bg-foreground/5 flex items-center justify-center shrink-0">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-foreground/35"
                    aria-hidden="true"
                  >
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-[11px] text-foreground/40 leading-relaxed">
                  Deploy HTML sites from the dashboard or let AI agents manage them through the
                  Agent Auth Protocol.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-[12px] font-medium text-foreground/50 uppercase tracking-wider"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md bg-background border border-border placeholder:text-foreground/25 focus:border-foreground/20 focus:ring-1 focus:ring-foreground/8 text-[13px] outline-none transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-[12px] font-medium text-foreground/50 uppercase tracking-wider"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md bg-background border border-border placeholder:text-foreground/25 focus:border-foreground/20 focus:ring-1 focus:ring-foreground/8 text-[13px] outline-none transition-all"
                    placeholder="Your password"
                  />
                </div>

                {error && (
                  <div className="px-3 py-2 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-500 text-[13px]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 text-[13px] font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="relative">
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
                className="w-full py-2 text-[13px] font-medium rounded-md border border-[#9945FF]/40 text-[#9945FF] hover:bg-[#9945FF]/5 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none" aria-hidden="true">
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

              <p className="text-center text-[13px] text-foreground/35">
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="text-foreground/60 hover:text-foreground font-medium transition-colors"
                >
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
