# CAAP Skill — Clawd Agent Attestation Protocol v1.0

## Overview

CAAP/1.0 is a Solana-native protocol for AI agent identity, verification, subscription gating, and OAuth. This skill covers the full integration of SIWS (Sign In With Solana), Metaplex Agent Registry, SPL 2022 token gating, and Agent OAuth bridging.

## Package Structure

```
@clawd/agent-auth-solana v0.2.0
├── src/
│   ├── index.ts          — Main exports
│   ├── siws-impl.ts      — ABNF-compliant SIWS message construction & verification
│   ├── client.ts         — Browser-safe SIWS helpers & Wallet Standard integration
│   ├── siws.ts           — Public re-exports from siws-impl
│   ├── attestation.ts    — DAS attestation via Helius RPC
│   ├── subscription.ts   — CLAWD token subscription tier logic
│   ├── metaplex-agent.ts — Metaplex Agent Registry: register, delegate, discover
│   ├── spl2022.ts        — SPL 2022 token gating & agent token binding
│   ├── agent-oauth.ts    — SIWS-based Agent OAuth session management
│   ├── caap-plugin.ts    — Better Auth plugin (all endpoints)
│   ├── plugin.ts         — Backward-compat re-export
│   ├── types.ts          — Config & session types
│   └── verify.ts         — CAAP hash verification
```

## Protocol Phases

### Phase 1: SIWS Authentication (ABNF-Compliant)

```ts
import { createSiwsInput, verifySiws, buildSiwsMessage } from "@clawd/agent-auth-solana";

// Server: create input with all optional fields
const input = createSiwsInput({
  address: walletAddress,
  nonce: "oBbLoEldZs12345",
  domain: "directory.localhost",
  chainId: "mainnet",
  statement: "Sign in to verify your wallet ownership.",
});

// The message is built per the ABNF spec:
//   ${domain} wants you to sign in with your Solana account:
//   ${address}
//   ...
const message = buildSiwsMessage(input);

// Client: have wallet sign the message → get { account, signature, signedMessage }
// Server: verify the output against the input
const valid = verifySiws(input, { account, signature, signedMessage });
```

### Phase 1.5: Client SIWS with Wallet Standard

```ts
import { signInWithSolana, supportsSignIn } from "@clawd/agent-auth-solana/client";

// Check if wallet supports signIn feature
if (supportsSignIn(walletAdapter)) {
  const result = await signInWithSolana(walletAdapter, input);
  // result.message, result.signature, result.publicKey
}
```

### Phase 2: Metaplex Agent Registry

```ts
import {
  registerAgent,
  registerExecutive,
  delegateAgentExecution,
  verifyAgentIdentity,
  findAgentsByOwner,
  buildAgentMetadata,
} from "@clawd/agent-auth-solana";

// Register an agent identity on-chain
const agent = await registerAgent(
  "assetPubkey...",
  "collectionPubkey...",
  "https://example.com/agent-metadata.json",
  { rpcUrl: "https://api.mainnet-beta.solana.com" }
);

// Register an executive profile (one-time per wallet)
const exec = await registerExecutive();

// Delegate execution to an executive
const delegation = await delegateAgentExecution(
  agent.asset,
  exec.authority
);

// Verify agent identity PDA exists
const { verified } = await verifyAgentIdentity(agent.asset);

// Discover agents owned by a wallet
const agents = await findAgentsByOwner("walletAddress...");

// Build EIP-8004 compliant metadata
const metadata = buildAgentMetadata({
  name: "My Agent",
  description: "An AI agent on Solana",
  services: [{ name: "MCP", endpoint: "https://myagent.com/mcp", skills: ["analysis"] }],
  x402Support: true,
});
```

### Phase 3: Agent OAuth (SIWS → OAuth Session)

```ts
import {
  verifyAgentSiws,
  createAgentOAuthSession,
  InMemoryAgentOAuthStore,
  validateAgentScopes,
} from "@clawd/agent-auth-solana";

const store = new InMemoryAgentOAuthStore();

// Verify SIWS + discover agent identity
const verification = await verifyAgentSiws(
  input,        // SolanaSignInInput
  output,        // { account, signature, signedMessage }
  undefined,     // auto-discover agent from wallet
  { rpcUrl: "..." }
);

// Validate OAuth scopes
const scopeCheck = validateAgentScopes(["agent:identity", "agent:execute"]);

// Create an OAuth session binding wallet + agent
const session = await createAgentOAuthSession(
  verification,
  "client-id-123",
  scopeCheck.scopes,
  store
);
// session.sessionId, session.walletAddress, session.agentAsset
```

### Phase 4: SPL 2022 Token Gating

```ts
import { checkTokenGate, validateSpl2022Mint } from "@clawd/agent-auth-solana";

// Check if wallet holds sufficient tokens
const gate = await checkTokenGate(
  "walletAddress...",
  "tokenMint...",
  1000, // minimum amount
  "https://api.mainnet-beta.solana.com"
);
// gate.allowed: boolean, gate.balance: number
```

### Phase 5: DAS Attestation + Subscription Tiers

```ts
import { attestAgent, computeTier, fetchWalletSnapshot } from "@clawd/agent-auth-solana";

const result = await attestAgent(agentId, walletAddress, {
  heliusRpcUrl: "https://mainnet.helius-rpc.com/?api-key=...",
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
});

const snapshot = await fetchWalletSnapshot(walletAddress, opts);
const tier = computeTier(snapshot.clawdBalance);
// tier.tier: "free" | "bronze" | "silver" | "gold" | "diamond"
```

## Better Auth Plugin (CAAP)

```ts
import { createCaapPlugin } from "@clawd/agent-auth-solana";

const plugin = createCaapPlugin({
  heliusApiKey: process.env.HELIUS_API_KEY,
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
  enableSubscriptionTiers: true,
  enableDasAttestation: true,
});
```

Registers all endpoints:
| Endpoint | Purpose |
|----------|---------|
| `POST /caap/attest` | Full attestation + wallet snapshot + tier |
| `GET /caap/status/:agentId` | Lightweight verified/unverified check |
| `GET /caap/discovery` | Protocol discovery document |
| `POST /caap/sign-in` | SIWS + Agent OAuth sign-in |
| `POST /caap/agents/register` | Metaplex agent registration |
| `POST /caap/executives/register` | Executive profile registration |
| `POST /caap/executives/delegate` | Delegate agent execution |
| `GET /caap/agents/:wallet` | List agents by owner |
| `GET /caap/verify-agent/:agentAsset` | Verify agent identity on-chain |
| `POST /caap/token-gate` | SPL 2022 token gating check |
| `POST /caap/metadata/build` | Build EIP-8004 metadata |

## Key Constants

- Default CLAWD mint: `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`
- CAAP protocol version: `1.0`
- Tier thresholds: Free=0, Bronze=100K, Silver=500K, Gold=1M, Diamond=5M
- Standard scopes: `agent:identity`, `agent:execute`, `agent:balance`, `agent:admin`, `wallet:read`, `siws:sign`
- SPL 2022 program ID: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

## Agent OAuth Flow

```
1. Client requests POST /caap/sign-in with:
   - SIWS input + signed output (from wallet)
   - OAuth clientId + requested scopes
2. Server verifies SIWS signature (nacl ed25519)
3. Server discovers/verifies Metaplex agent identity
4. Server creates OAuth session binding wallet + agent
5. Server returns sessionId + agent claims
6. Client uses sessionId for subsequent OAuth token exchange
```

## Live Demo

See [x402.wtf/agentauth](https://x402.wtf/agentauth) or [siws.vercel.app](https://siws.vercel.app/) for a live interactive demo.