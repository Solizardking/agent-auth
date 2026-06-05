// GET /api/tee/report
// Returns a fresh Phala dstack TEE attestation report for the relay instance.
// Useful for clients to verify they are talking to a genuine TEE-hosted relay.

import { NextRequest, NextResponse } from "next/server";
import { fetchPhalaAttestation } from "@clawd/clerk-caap/tee";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Bind the quote to a fresh server-side nonce so it can't be replayed
  const nonce = req.nextUrl.searchParams.get("nonce") ?? crypto.randomUUID();
  const caapHash = createHash("sha256")
    .update(`relay-health:${nonce}:${Date.now()}`)
    .digest("hex");

  const tee = await fetchPhalaAttestation(caapHash);

  return NextResponse.json({
    caapVersion: "1.0",
    purpose: "relay-health",
    nonce,
    tee,
    relayCaapHash: caapHash,
    timestamp: new Date().toISOString(),
  });
}
