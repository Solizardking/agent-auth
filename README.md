# Clawd Agent Auth

Open-source implementations of agent authentication for AI agents — with first-class support for **Solana wallet sign-in (SIWS)**, on-chain identity attestation via the Metaplex Agent Registry, and subscription tiers backed by SPL token holdings.

Built on top of the [Agent Auth Protocol](https://agent-auth-protocol.com) and [Better Auth](https://better-auth.com).

## What's Inside

| Package | Description | Install |
|---------|-------------|---------|
| [`@better-auth/agent-auth`](packages/agent-auth/) | Better Auth server plugin — capabilities, registration, JWTs | `npm i @better-auth/agent-auth` |
| [`@clawd/agent-auth-solana`](packages/agent-auth-solana/) | Solana extension — SIWS, DAS attestation, CAAP protocol | `npm i @clawd/agent-auth-solana` |
| [`@auth/agent`](packages/sdk/) | Client SDK for agent runtimes | `npm i @auth/agent` |
| [`@auth/agent-cli`](packages/cli/) | CLI and MCP server | `npx @auth/agent-cli` |

## Apps

| App | Description |
|-----|-------------|
| [`apps/directory`](apps/directory/) | Agent directory — browse verified agents, CAAP-attested Solana agents |
| [`apps/agent-extension`](apps/agent-extension/) | Browser extension for agent identity management |

## Examples

| Example | Description |
|---------|-------------|
| [`examples/agent-deploy`](examples/agent-deploy/) | Baseline Better Auth flow |
| [`examples/gmail-proxy`](examples/gmail-proxy/) | Gmail proxy with WebAuthn |
| [`examples/vercel-proxy`](examples/vercel-proxy/) | Vercel proxy pattern |

## CAAP: Clawd Agent Attestation Protocol

`@clawd/agent-auth-solana` implements **CAAP/1.0** — a Solana-native agent identity standard that ties together:

1. **SIWS** — Sign In With Solana (Ed25519 signature over a structured message)
2. **DAS Verification** — Metaplex Agent Registry + Helius `getAssetsByOwner` to confirm the agent NFT is owned by the signing wallet
3. **SPL Attestation** — Verify CLAWD token account ownership matches the same wallet
4. **Subscription Tiers** — Token balance → tier (Free / Bronze 100K / Silver 500K / Gold 1M / Diamond 5M CLAWD)

### Attestation hash

```
sha256(`${agentId}:${wallet}:${clawdMint}:${timestamp}`)
```

This hash is stored on-chain (via Convex) and becomes the persistent agent identity fingerprint.

## Quick Start

### Server (Better Auth + SIWS + CAAP)

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { siws } from "better-auth-solana";
import { createCaapPlugin } from "@clawd/agent-auth-solana";

export const auth = betterAuth({
  plugins: [
    siws({ domain: "x402.wtf" }),
    createCaapPlugin({
      heliusApiKey: process.env.HELIUS_API_KEY,
      clawdMint: process.env.CLAWD_TOKEN_ADDRESS,
      enableSubscriptionTiers: true,
      enableDasAttestation: true,
    }),
  ],
});
```

### Client (SIWS sign-in)

```ts
import { createAuthClient } from "better-auth/client";
import { siwsClient, createSIWSMessage } from "better-auth-solana/client";

const authClient = createAuthClient({
  plugins: [siwsClient()],
});

// 1. Get nonce
const { data: nonceData } = await authClient.siws.nonce({ walletAddress: address });

// 2. Sign with wallet
const message = createSIWSMessage({
  address,
  challenge: nonceData,
  statement: "Sign in to Clawd",
});
const signature = await wallet.signMessage(new TextEncoder().encode(message));

// 3. Verify + establish session
await authClient.siws.verify({
  message,
  signature: Buffer.from(signature).toString("base64"),
  walletAddress: address,
});
```

### Attest an Agent

```ts
import { attestAgent, computeTier } from "@clawd/agent-auth-solana";

const result = await attestAgent("my-agent-id", walletAddress, {
  heliusRpcUrl: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
});

if (result.verified) {
  const tier = computeTier(result.tokenBalance ?? 0);
  console.log(`Agent verified — ${tier.tier} tier (${tier.clawdBalance.toLocaleString()} CLAWD)`);
  console.log("Attestation hash:", result.attestationHash);
}
```

## Discovery Document

Servers expose `/.well-known/agent-configuration`:

```json
{
  "issuer": "https://x402.wtf",
  "provider_name": "Clawd Browser",
  "modes": ["delegated", "autonomous"],
  "capabilities": [
    { "name": "attest_agent", "description": "Attest an agent identity against its Solana wallet and on-chain NFT." },
    { "name": "get_peer_card", "description": "Retrieve a verified agent peer card with wallet and subscription data." }
  ],
  "solana": {
    "network": "mainnet-beta",
    "attestation_protocol": "CAAP/1.0"
  }
}
```

## Subscription Tiers

| Tier | CLAWD Required | Features |
|------|---------------|----------|
| Free | 0 | Basic auth, SIWS sign-in |
| Bronze | 100,000 | + Agent attestation, peer card |
| Silver | 500,000 | + Priority verification, history |
| Gold | 1,000,000 | + Real-time wallet monitoring, webhooks |
| Diamond | 5,000,000 | + All features, enterprise SLA |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Skills

AI coding agents can use the CAAP skill:

```bash
npx skills add caap
# or reference skills/caap.md directly
```

## Live Demo

[x402.wtf/agentauth](https://x402.wtf/agentauth) — interactive SIWS demo, protocol overview, and whitepaper.

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Clawd Labs](https://x402.wtf) · Powered by [Helius](https://helius.dev), [Metaplex](https://metaplex.com), [Better Auth](https://better-auth.com)
