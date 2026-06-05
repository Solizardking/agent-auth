// POST /api/siws/verify
// Verifies a SIWS signature, runs CAAP DAS attestation, and wraps the
// result in a Phala TEE quote. Does NOT require a Clerk JWT — this is the
// pure Solana-native auth path.

import { NextRequest, NextResponse } from "next/server";
import {
  verifySiws,
  attestAgent,
  fetchWalletSnapshot,
  computeTier,
  type SolanaSignInInput,
} from "@clawd/agent-auth-solana";
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

interface SiwsVerifyBody {
  siwsInput: SolanaSignInInput;
  output: {
    account: { publicKey: number[] };
    signature: number[];
    signedMessage: number[];
  };
  agentId?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as SiwsVerifyBody | null;

  if (!body?.siwsInput || !body?.output) {
    return NextResponse.json(
      { error: "siwsInput and output required" },
      { status: 400 },
    );
  }

  // 1. Verify SIWS signature
  const valid = verifySiws(body.siwsInput, body.output);
  if (!valid) {
    return NextResponse.json({ error: "SIWS signature invalid" }, { status: 401 });
  }

  const walletAddress = body.siwsInput.address;
  if (!walletAddress) {
    return NextResponse.json({ error: "siwsInput.address required" }, { status: 400 });
  }

  const agentId = body.agentId ?? walletAddress;

  // 2. CAAP attestation + snapshot
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

  // 3. Phala TEE attestation
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

  const teeAttestation = await fetchPhalaAttestation(caapHash);

  return NextResponse.json({
    caapVersion: "1.0",
    protocol: "CAAP/1.0",
    agentId,
    walletAddress,
    siwsVerified: true,
    attestation: attest,
    snapshot,
    tier,
    tee: teeAttestation,
    verified: attest.verified && teeAttestation.hasTeeEvidence,
    timestamp: new Date().toISOString(),
  });
}
