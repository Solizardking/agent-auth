---
name: clerk-caap
description: >
  Bridge Clerk session tokens with Solana CAAP/1.0 onchain attestation. Verifies
  Clerk JWTs, attaches Phala TEE hardware-rooted TDX proof, and provides Next.js
  middleware for protecting CAAP attestation endpoints. Use when integrating Clerk
  auth with Solana agent identity, building token-gated agent features, or adding
  TEE attestation to Clerk-protected routes.
license: MIT
metadata:
  author: clawd-labs
  version: "0.1.0"
  homepage: https://pay.sh/services/auth/agent
  repo: https://github.com/Solizardking/agent-auth
  package: "@clawd/clerk-caap"
---

# Clerk CAAP Bridge

Bridges [Clerk](https://clerk.com) session tokens with CAAP/1.0 onchain attestation. Uses the `relaxing-collie-65` Clerk instance.

## Overview

`@clawd/clerk-caap` ties Clerk identity to Solana agent attestation and Phala TEE hardware proofs. When a user signs in via Clerk, their Solana wallet address (stored in `publicMetadata`) is used to run a full CAAP/1.0 attestation flow — DAS NFT verification, SPL token balance check, and Phala TDX quote binding.

## Clerk Instance

| Flow | URL |
|------|-----|
| Sign in | `https://relaxing-collie-65.accounts.dev/sign-in` |
| Sign up | `https://relaxing-collie-65.accounts.dev/sign-up` |
| Waitlist | `https://relaxing-collie-65.accounts.dev/waitlist` |
| Unauthorized | `https://relaxing-collie-65.accounts.dev/unauthorized-sign-in` |

## JWT Template

In your Clerk dashboard, create a JWT template named `solana_wallet`:

```json
{
  "wallet_address": "{{user.publicMetadata.wallet_address}}",
  "agent_id": "{{user.publicMetadata.agent_id}}"
}
```

## Usage

### Verify Clerk Token

```ts
import { verifyClerkToken, fetchPhalaAttestation } from "@clawd/clerk-caap";

// 1. Verify Clerk session token
const claims = await verifyClerkToken(sessionToken);
// → { sub, wallet_address, agent_id, iat, exp }

// 2. Run CAAP attestation (via relay or directly)
const response = await fetch("https://relay.clawd.xyz/api/caap/attest", {
  method: "POST",
  headers: { Authorization: `Bearer ${sessionToken}` },
  body: JSON.stringify({ walletAddress: claims.wallet_address }),
});
// → { verified, attestation, tee: { intelQuote, explorerUrl, mrAggregated, ... } }
```

### Next.js Middleware

```ts
// middleware.ts
import { createClerkCaapMiddleware } from "@clawd/clerk-caap/middleware";

export const middleware = createClerkCaapMiddleware({
  protectedPaths: [/^\/api\/caap\/attest/],
  publicPaths: [/^\/api\/caap\/discovery/, /^\/api\/siws\//],
});
```

### TEE Attestation Fields

The relay follows the Phala Redpill / dstack TEE attestation structure:

| Field | Description |
|-------|-------------|
| `appId` | Phala dstack app ID |
| `instanceId` | CVM instance ID |
| `composeHash` | Hash of the docker-compose.yml |
| `mrAggregated` | Aggregate measurement register |
| `mrtd` | TDX MRTD measurement |
| `rtmr0`–`rtmr3` | Runtime measurement registers |
| `intelQuote` | Raw Intel TDX quote (base64) |
| `explorerUrl` | `proof.t16z.com/?attestation=...` |
| `hasTeeEvidence` | `true` when quote generation succeeded |

## Exports

| Module | Description |
|--------|-------------|
| `@clawd/clerk-caap` | Main entry — `verifyClerkToken`, `fetchPhalaAttestation` |
| `@clawd/clerk-caap/middleware` | Next.js middleware factory |
| `@clawd/clerk-caap/tee` | TEE attestation helpers (tappd integration) |
| `@clawd/clerk-caap/verify` | Clerk JWT verification utilities |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `CLERK_JWT_KEY` | No | Clerk RSA public key (for offline JWT verification in TEE) |
| `HELIUS_API_KEY` | Yes | Helius RPC/DAS API key |
| `DSTACK_SIMULATOR_ENDPOINT` | No | Phala tappd endpoint (default: `http://localhost:8090`) |

## Full Clerk + TEE Flow

```ts
// 1. User signs in via Clerk (relaxing-collie-65.accounts.dev)
// 2. Get Clerk session token
const { getToken } = useAuth(); // @clerk/nextjs
const token = await getToken({ template: "solana_wallet" });

// 3. Verify the token server-side
const claims = await verifyClerkToken(token);

// 4. POST to relay — runs SIWS + DAS + Phala TDX attestation
const res = await fetch("https://relay.clawd.xyz/api/caap/attest", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ walletAddress: claims.wallet_address }),
});

const { verified, attestation, tee, tier } = await res.json();
// tee.explorerUrl → proof.t16z.com link for onchain verification