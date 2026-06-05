// POST /api/siws/challenge
// Generates a SIWS sign-in input for a given wallet address.
// The client signs this with their Solana wallet, then calls /api/siws/verify.

import { NextRequest, NextResponse } from "next/server";
import { createSiwsInput } from "@clawd/agent-auth-solana";

export const runtime = "nodejs";

const DOMAIN =
  process.env.RELAY_DOMAIN ?? "relay.clawd.xyz";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    address?: string;
    nonce?: string;
  };

  const input = createSiwsInput({
    address: body.address,
    nonce: body.nonce,
    domain: DOMAIN,
    uri: `https://${DOMAIN}`,
    statement:
      "Sign in to Clawd Agent Relay. This request will not trigger a blockchain transaction or cost any gas fees.",
  });

  return NextResponse.json({
    caapVersion: "1.0",
    siwsInput: input,
  });
}
