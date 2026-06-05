// POST /api/caap/attest — directory app CAAP attestation endpoint.
// Verifies a Clerk JWT, runs onchain DAS attestation, and returns a
// Phala TEE-attested result following the phaal pattern.

import { NextRequest, NextResponse } from "next/server";
import { attestAgent, fetchWalletSnapshot, computeTier } from "@clawd/agent-auth-solana";
import { verifyClerkToken, extractBearerToken } from "@clawd/clerk-caap/verify";
import { fetchPhalaAttestation } from "@clawd/clerk-caap/tee";

export const runtime = "nodejs";

const CLAWD_MINT =
  process.env.CLAWD_TOKEN_ADDRESS ?? "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump";

function heliusRpcUrl() {
  const key = process.env.HELIUS_API_KEY ?? "";
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
}

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Authorization: Bearer <clerk_token> required" }, { status: 401 });
  }

  let clerkClaims;
  try {
    clerkClaims = await verifyClerkToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired Clerk token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    walletAddress?: string;
    agentId?: string;
  };

  const walletAddress = body.walletAddress ?? clerkClaims.wallet_address ?? null;
  const agentId = body.agentId ?? clerkClaims.agent_id ?? clerkClaims.sub;

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress required in body or Clerk wallet_address claim" },
      { status: 400 },
    );
  }

  const opts = { heliusRpcUrl: heliusRpcUrl(), clawdMint: CLAWD_MINT };

  const [attestResult, snapshotResult] = await Promise.allSettled([
    attestAgent(agentId, walletAddress, opts),
    fetchWalletSnapshot(walletAddress, opts),
  ]);

  const attest =
    attestResult.status === "fulfilled"
      ? attestResult.value
      : { verified: false, error: "attestation failed" };

  const snapshot =
    snapshotResult.status === "fulfilled" ? snapshotResult.value : null;

  const tier = computeTier(snapshot?.clawdBalance ?? 0);

  const caapHash =
    attest.attestationHash ??
    (await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${agentId}:${walletAddress}:${Date.now()}`),
    ).then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ));

  const tee = await fetchPhalaAttestation(caapHash);

  return NextResponse.json({
    caapVersion: "1.0",
    clerkSub: clerkClaims.sub,
    agentId,
    walletAddress,
    attestation: attest,
    snapshot,
    tier,
    tee,
    verified: attest.verified && tee.hasTeeEvidence,
    timestamp: new Date().toISOString(),
  });
}
