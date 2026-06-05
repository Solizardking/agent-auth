import { NextResponse } from "next/server";

const CLAWD_MINT = "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    protocol: "CAAP/1.0",
    version: "1.0",
    name: "Clawd Agent Attestation Protocol",
    description: "Clerk + Solana SIWS agent auth with Phala TEE onchain attestation",
    network: "solana-mainnet",
    clawdMint: CLAWD_MINT,
    clerk: {
      frontendApi: "https://relaxing-collie-65.clerk.accounts.dev",
      signIn: "https://relaxing-collie-65.accounts.dev/sign-in",
      signUp: "https://relaxing-collie-65.accounts.dev/sign-up",
      waitlist: "https://relaxing-collie-65.accounts.dev/waitlist",
    },
    tee: {
      provider: "phala-dstack",
      explorerBase: "https://proof.t16z.com",
    },
    tiers: {
      free: 0,
      bronze: 100_000,
      silver: 500_000,
      gold: 1_000_000,
      diamond: 5_000_000,
    },
    endpoints: {
      discovery: "GET /api/caap/discovery",
      attest: "POST /api/caap/attest",
      status: "GET /api/caap/status/:agentId",
      siwsChallenge: "POST /api/siws/challenge",
      siwsVerify: "POST /api/siws/verify",
      teeReport: "GET /api/tee/report",
    },
  });
}
