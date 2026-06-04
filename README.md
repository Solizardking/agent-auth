<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=1000&color=A855F7&center=true&vCenter=true&width=600&lines=Clawd+Agent+Auth;CAAP%2F1.0+Protocol;Solana+Native+Agent+Identity;Sign+In+With+Solana+(SIWS)" alt="Typing SVG" />

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=for-the-badge)](LICENSE)
[![npm](https://img.shields.io/npm/v/@clawd/agent-auth-solana?style=for-the-badge&color=a855f7&logo=npm)](https://www.npmjs.com/package/@clawd/agent-auth-solana)
[![npm](https://img.shields.io/npm/v/@better-auth/agent-auth?style=for-the-badge&color=06b6d4&logo=npm)](https://www.npmjs.com/package/@better-auth/agent-auth)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF?style=for-the-badge&logo=solana)](https://solana.com)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.5+-00D4AA?style=for-the-badge)](https://better-auth.com)

<br />

**Open-source agent authentication for AI agents — with Solana-native identity, on-chain attestation, and token-gated subscription tiers.**

Built on the [Agent Auth Protocol](https://agent-auth-protocol.com) · Powered by [Helius](https://helius.dev) + [Metaplex](https://metaplex.com) + [Better Auth](https://better-auth.com)

[**Live Demo →**](https://x402.wtf/agentauth) · [**Docs →**](https://x402.wtf/docs) · [**Protocol Paper →**](https://x402.wtf/agentauth#paper)

</div>

---

## What is this?

Most auth systems were built for humans. AI agents are different — they run autonomously, act on behalf of users, and need cryptographic identity that:

- **Proves wallet ownership** on Solana via Ed25519 signatures (SIWS)
- **Attests on-chain** that the agent NFT and its SPL token are owned by the same wallet
- **Scales access** through token holdings — hold more CLAWD, unlock more capabilities
- **Persists across sessions** — one attestation hash binds the agent identity forever

This repo ships everything you need to implement this end-to-end.

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@clawd/agent-auth-solana`](packages/agent-auth-solana/) | [![npm](https://img.shields.io/npm/v/@clawd/agent-auth-solana?color=a855f7)](https://npmjs.com/package/@clawd/agent-auth-solana) | 🔮 Solana extension — SIWS, DAS attestation, CAAP/1.0 |
| [`@better-auth/agent-auth`](packages/agent-auth/) | [![npm](https://img.shields.io/npm/v/@better-auth/agent-auth?color=06b6d4)](https://npmjs.com/package/@better-auth/agent-auth) | ⚡ Better Auth plugin — capabilities, JWTs, registration |
| [`@auth/agent`](packages/sdk/) | [![npm](https://img.shields.io/npm/v/@auth/agent?color=10b981)](https://npmjs.com/package/@auth/agent) | 🤖 Client SDK for agent runtimes |
| [`@auth/agent-cli`](packages/cli/) | [![npm](https://img.shields.io/npm/v/@auth/agent-cli?color=f59e0b)](https://npmjs.com/package/@auth/agent-cli) | 🛠️ CLI + MCP server |

---

## One-shot Install

```bash
# Full stack (server + Solana + SDK)
npx @clawd/agent-auth-install
```

Or pick what you need:

```bash
# Server only
npm install @better-auth/agent-auth better-auth

# Solana extension (SIWS + CAAP)
npm install @clawd/agent-auth-solana better-auth-solana @solana/kit

# Client SDK
npm install @auth/agent

# CLI
npm install -g @auth/agent-cli
```

---

## The CAAP Protocol

**Clawd Agent Attestation Protocol v1.0** — four phases, one permanent identity hash.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAAP/1.0 Flow                                │
├──────────┬──────────────┬──────────────┬────────────────────────┤
│ Phase 1  │   Phase 2    │   Phase 3    │       Phase 4          │
│  SIWS    │    DAS       │    SPL       │        Tier            │
│          │              │              │                        │
│ Sign msg │ getAssetsByO │ getTokenAcct │ CLAWD balance          │
│ w/ wallet│ -wner (Heli) │ -sByOwner    │ → tier badge           │
│          │              │              │                        │
│ Ed25519  │ Agent NFT    │ CLAWD token  │ Free → Diamond         │
│ verify   │ owner match  │ owner match  │                        │
├──────────┴──────────────┴──────────────┴────────────────────────┤
│         attestationHash = sha256(agentId:wallet:mint:ts)        │
└─────────────────────────────────────────────────────────────────┘
```

### Subscription Tiers

| Tier | CLAWD Required | Badge |
|------|---------------|-------|
| 🩶 Free | 0 | Basic SIWS sign-in |
| 🟤 Bronze | 100,000+ | + Agent attestation, peer card |
| ⚪ Silver | 500,000+ | + History, priority verify |
| 🟡 Gold | 1,000,000+ | + Real-time monitoring, webhooks |
| 💎 Diamond | 5,000,000+ | + All features, enterprise SLA |

---

## Quick Start

### 1. Server setup (Better Auth + SIWS + CAAP)

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { siws } from "better-auth-solana";
import { createCaapPlugin } from "@clawd/agent-auth-solana";

export const auth = betterAuth({
  plugins: [
    // Sign In With Solana
    siws({ domain: "your-app.com" }),

    // CAAP/1.0 — attestation, peer cards, tiers
    createCaapPlugin({
      heliusApiKey: process.env.HELIUS_API_KEY,
      clawdMint: process.env.CLAWD_TOKEN_ADDRESS,
      enableSubscriptionTiers: true,
      enableDasAttestation: true,
    }),

    // Standard agent auth capabilities
    agentAuth({
      capabilities: [
        { name: "attest_agent", description: "Attest a Solana agent identity" },
        { name: "get_peer_card", description: "Fetch verified agent peer card" },
      ],
    }),
  ],
});
```

### 2. Client sign-in (SIWS)

```ts
import { createAuthClient } from "better-auth/client";
import { siwsClient, createSIWSMessage } from "better-auth-solana/client";

const authClient = createAuthClient({ plugins: [siwsClient()] });

// Step 1: get nonce
const { data } = await authClient.siws.nonce({ walletAddress: address });

// Step 2: sign with wallet (Phantom, Backpack, etc.)
const message = createSIWSMessage({
  address,
  challenge: data,
  statement: "Sign in to my app",
});
const signature = await wallet.signMessage(new TextEncoder().encode(message));

// Step 3: verify → session created
await authClient.siws.verify({
  message,
  signature: Buffer.from(signature).toString("base64"),
  walletAddress: address,
});
```

### 3. Attest an agent

```ts
import { attestAgent, computeTier } from "@clawd/agent-auth-solana";

const result = await attestAgent("my-agent-id", walletAddress, {
  heliusRpcUrl: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
});

if (result.verified) {
  const { tier, clawdBalance } = computeTier(result.tokenBalance ?? 0);
  console.log(`✅ Agent verified`);
  console.log(`   Tier: ${tier} (${clawdBalance.toLocaleString()} CLAWD)`);
  console.log(`   Hash: ${result.attestationHash}`);
}
```

### 4. Discovery document

Every CAAP server auto-exposes `/.well-known/agent-configuration`:

```json
{
  "issuer": "https://your-app.com",
  "provider_name": "Your App",
  "modes": ["delegated", "autonomous"],
  "solana": {
    "network": "mainnet-beta",
    "attestation_protocol": "CAAP/1.0",
    "clawd_mint": "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump"
  },
  "capabilities": [
    { "name": "attest_agent", "description": "Attest agent identity on-chain" },
    { "name": "get_peer_card", "description": "Fetch verified agent peer card" },
    { "name": "list_agents", "description": "List verified agents" }
  ]
}
```

---

## Apps

| App | Description | Stack |
|-----|-------------|-------|
| [`apps/directory`](apps/directory/) | Agent directory — browse CAAP-verified Solana agents | Next.js 15, Drizzle, Better Auth |
| [`apps/agent-extension`](apps/agent-extension/) | Browser extension for agent identity management | Vite, React, TypeScript |

---

## Examples

| Example | What it shows |
|---------|--------------|
| [`examples/agent-deploy`](examples/agent-deploy/) | Basic agent auth flow with email sign-in |
| [`examples/agent-coffee`](examples/agent-coffee/) | Agent commerce with billing and orders |
| [`examples/brex-agent`](examples/brex-agent/) | Fintech agent with payment capabilities |
| [`examples/stripe-agents`](examples/stripe-agents/) | Stripe payment agent with approval flow |
| [`examples/gmail-proxy`](examples/gmail-proxy/) | Gmail proxy with WebAuthn approval |
| [`examples/vercel-proxy`](examples/vercel-proxy/) | Vercel proxy with passkey auth |

---

## Skills

AI coding agents can use the CAAP skill file:

```bash
# With Claude Code / skills-enabled runtimes
npx skills add clawd/caap

# Or reference directly
cat skills/caap.md
```

---

## Environment Variables

Copy `.env.example` in any app and fill in:

```bash
# Required for CAAP attestation
HELIUS_API_KEY=your_helius_api_key      # helius.dev
CLAWD_TOKEN_ADDRESS=8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump

# Required for Better Auth
BETTER_AUTH_SECRET=                      # openssl rand -base64 32
DATABASE_URL=postgresql://...

# Optional: Helius webhook verification
HELIUS_WEBHOOK_SECRET=                   # for real-time wallet monitoring
```

**No private keys are ever stored or committed. The repo contains zero secrets.**

---

## Development

```bash
# Clone and install
git clone https://github.com/Solizardking/agent-auth
cd agent-auth
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Format (Oxfmt)
pnpm fmt
```

Node.js ≥22 required. Uses pnpm workspaces + Turbo.

---

## Contributing

PRs welcome. Please open an issue first for large changes.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes and add tests
4. Run `pnpm fmt && pnpm typecheck && pnpm test`
5. Open a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) if it exists, otherwise just open an issue.

---

## Publishing

Packages are published to npm under the `@clawd` and `@better-auth` scopes. To publish:

```bash
# Bump versions
pnpm bump

# Publish (requires NPM_TOKEN in environment or .npmrc)
NPM_TOKEN=your_token pnpm -r publish --access public
```

Or push a tag to trigger the GitHub Actions release workflow:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

---

## Architecture

```
agent-auth/
├── packages/
│   ├── agent-auth/          # @better-auth/agent-auth — server plugin
│   ├── agent-auth-solana/   # @clawd/agent-auth-solana — Solana extension
│   ├── sdk/                 # @auth/agent — client SDK
│   └── cli/                 # @auth/agent-cli — CLI + MCP
├── apps/
│   ├── directory/           # Agent directory (Next.js)
│   └── agent-extension/     # Browser extension (Vite)
├── examples/                # Reference implementations
└── skills/                  # AI agent skill files (caap.md)
```

---

<div align="center">

**Built by [Clawd Labs](https://x402.wtf)** · MIT License · Powered by Solana

[![GitHub stars](https://img.shields.io/github/stars/Solizardking/agent-auth?style=social)](https://github.com/Solizardking/agent-auth/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Solizardking/agent-auth?style=social)](https://github.com/Solizardking/agent-auth/network/members)
[![Twitter Follow](https://img.shields.io/twitter/follow/clawdlabs?style=social)](https://twitter.com/clawdlabs)

*Fork it. Star it. Build with it.*

</div>
