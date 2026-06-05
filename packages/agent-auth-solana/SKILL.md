# CAAP Skill — Clawd Agent Attestation Protocol

## Overview

CAAP/1.0 is a Solana-native protocol for AI agent identity, verification, and subscription gating. Use this skill when you need to:

- Authenticate an AI agent using Sign In With Solana (SIWS)
- Verify agent NFT ownership via Helius DAS API
- Check CLAWD token balance for subscription tier gating
- Register on-chain agent identities via the Metaplex Agent Registry (EIP-8004)
- Launch agent tokens via Genesis bonding curves with permanent token-agent binding
- Integrate Better Auth with Solana wallet sign-in
- Implement token-gated agent features

## Package

```
@clawd/agent-auth-solana
```

Located at: `agent-auth-main/packages/agent-auth-solana/`

## Protocol Phases

### Phase 1: SIWS Authentication

```ts
import { createSiwsInput, verifySiws } from "@clawd/agent-auth-solana";

// Server: create the input
const input = createSiwsInput({ address: walletAddress, nonce });

// Client: build the message string and sign it
// Server: verify the signed output
const valid = verifySiws(input, { account, signature, signedMessage });
```

### Phase 2: DAS Verification

Helius DAS API `getAssetsByOwner` is called to find agent NFTs (names containing "agent" or "clawd") in the wallet. Uses `getAccountInfo` on `agentId` to check Metaplex registry presence.

### Phase 3: Token Attestation

```ts
import { attestAgent } from "@clawd/agent-auth-solana";

const result = await attestAgent(agentId, walletAddress, {
  heliusRpcUrl: "https://mainnet.helius-rpc.com/?api-key=...",
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
});
// result.verified, result.tokenBalance, result.attestationHash
```

### Phase 4: Subscription Tier

```ts
import { computeTier, tierLabel, TIER_THRESHOLDS } from "@clawd/agent-auth-solana";

const tier = computeTier(clawdBalance);
// tier.tier: "free" | "bronze" | "silver" | "gold" | "diamond"
// tier.nextTier, tier.percentToNext, tier.clawdToNextTier
```

## Metaplex Agent Identity (Global On-Chain Identity)

### EIP-8004 Registration Document

Every agent gets an EIP-8004-compliant registration document, making it globally discoverable across the Metaplex Agent Registry and any EIP-8004 consumer.

```ts
import {
  buildEip8004Registration,
  buildRegisterIdentityParams,
  deriveAssetSignerPda,
  deriveAgentIdentityPda,
} from "@clawd/agent-auth-solana";

// Build the EIP-8004 registration document
const doc = buildEip8004Registration({
  name: "Plexpert",
  description: "An informational agent providing help related to Metaplex protocols and tools.",
  image: "https://arweave.net/agent-avatar-tx-hash",
  assetPublicKey: "ABC123...",
  services: [
    { name: "web", endpoint: "https://metaplex.com/agent/ABC123" },
    { name: "A2A", endpoint: "https://metaplex.com/agent/ABC123/agent-card.json", version: "0.3.0" },
    { name: "MCP", endpoint: "https://metaplex.com/agent/ABC123/mcp", version: "2025-06-18" },
  ],
  supportedTrust: ["reputation", "crypto-economic"],
  x402Support: true,
});

// Derive the agent's identity PDA (makes it discoverable on-chain)
const identityPda = deriveAgentIdentityPda("ABC123...");

// Derive the asset signer PDA (agent's wallet, no private key)
const assetSignerPda = deriveAssetSignerPda("ABC123...");
```

### On-Chain Registration

```ts
import { buildRegisterIdentityParams } from "@clawd/agent-auth-solana";
// Then pass to @metaplex-foundation/mpl-agent-registry:
import { registerIdentityV1 } from "@metaplex-foundation/mpl-agent-registry";

const params = buildRegisterIdentityParams({
  asset: "MPL_CORE_ASSET_PUBKEY",
  collection: "COLLECTION_PUBKEY", // optional but recommended
  agentRegistrationUri: "https://arweave.net/registration-json-hash",
});

await registerIdentityV1(umi, params).sendAndConfirm(umi);
```

### Verify On-Chain Registration

```ts
import { verifyAgentRegistration, fetchAgentRegistrationDoc } from "@clawd/agent-auth-solana";

const result = await verifyAgentRegistration("ASSET_PUBKEY", rpcUrl);
console.log("Registered:", result.registered);

// Fetch the full EIP-8004 doc from the on-chain URI
if (result.uri) {
  const doc = await fetchAgentRegistrationDoc(result.uri);
  console.log(doc.name, doc.services);
}
```

## Execution Delegation

Allow an off-chain executive to sign transactions on behalf of the agent through Core's Execute lifecycle hook.

```ts
import {
  buildDelegateExecutionParams,
  deriveExecutiveProfilePda,
  deriveExecutionDelegateRecordPda,
} from "@clawd/agent-auth-solana";

const params = buildDelegateExecutionParams({
  agentAsset: "AGENT_ASSET_PUBKEY",
  executiveAuthority: "EXECUTIVE_WALLET_PUBKEY",
});

// Then pass to @metaplex-foundation/mpl-agent-registry:
import { delegateExecutionV1 } from "@metaplex-foundation/mpl-agent-registry";
await delegateExecutionV1(umi, params).sendAndConfirm(umi);
```

## Agent Token Launch (Genesis Bonding Curve)

Launch a token from the agent's Asset Signer PDA with a permanent token-agent binding (setAgentTokenV1).

```ts
import {
  buildGenesisLaunchInput,
  validateGenesisLaunchInput,
} from "@clawd/agent-auth-solana";

const input = buildGenesisLaunchInput({
  agentAsset: "AGENT_ASSET_PUBKEY",
  setToken: true, // IRREVERSIBLE — permanent binding
  payer: "PAYER_WALLET",
  tokenName: "Agent Token",
  tokenSymbol: "AGT",
  tokenImage: "https://gateway.irys.xyz/your-image-id",
  tokenDescription: "The official token of my agent",
  firstBuyAmount: 0.1, // 0.1 SOL fee-free first buy
});

const errors = validateGenesisLaunchInput(input);
if (errors.length === 0) {
  // Then pass to @metaplex-foundation/genesis:
  // await createAndRegisterLaunch(umi, {}, input).sendAndConfirm(umi);
}
```

### CLI Equivalent

```bash
mplx genesis launch create --launchType bonding-curve \
  --name "Agent Token" \
  --symbol "AGT" \
  --image "https://gateway.irys.xyz/your-image-hash" \
  --agentAsset <AGENT_CORE_ASSET_ADDRESS> \
  --agentSetToken
```

### Set Agent Token (Existing Token)

If you already launched a token without `setToken: true`, bind it retroactively:

```ts
import { buildSetAgentTokenParams } from "@clawd/agent-auth-solana";

const params = buildSetAgentTokenParams({
  agentAsset: "AGENT_ASSET_PUBKEY",
  agentCollection: "COLLECTION_PUBKEY",
  genesisAccount: "GENESIS_ACCOUNT_PUBKEY",
});

// Then wrap in Core Execute:
// import { execute, findAssetSignerPda } from "@metaplex-foundation/mpl-core";
// import { setAgentTokenV1 } from "@metaplex-foundation/mpl-agent-registry";
// await execute(umi, { asset, collection, instructions: setAgentTokenV1(umi, params) }).sendAndConfirm(umi);
```

## Better Auth Plugin

```ts
import { createCaapPlugin } from "@clawd/agent-auth-solana";

const plugin = createCaapPlugin({
  heliusApiKey: process.env.HELIUS_API_KEY,
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
  enableSubscriptionTiers: true,
  enableDasAttestation: true,
  identityRpcUrl: process.env.SOLANA_RPC_URL, // optional, defaults to helius
});
```

Registers these endpoints:
- `POST /caap/attest` — full attestation + snapshot + tier
- `GET /caap/status/:agentId?wallet=` — lightweight verified/unverified
- `GET /caap/discovery` — CAAP/1.0 protocol discovery document
- `POST /agent/identity/register` — build EIP-8004 doc + registerIdentityV1 params
- `GET /agent/identity/verify/:asset` — check on-chain Metaplex Agent Registry registration
- `POST /agent/identity/delegate` — build delegateExecutionV1 params
- `POST /agent/token/set` — build setAgentTokenV1 params (permanent binding)
- `POST /agent/token/launch` — build Genesis bonding curve launch input

## Wallet Snapshot

```ts
import { fetchWalletSnapshot } from "@clawd/agent-auth-solana";

const snapshot = await fetchWalletSnapshot(walletAddress, {
  heliusRpcUrl: "...",
  clawdMint: "...",
});
// snapshot.solBalance, snapshot.clawdBalance, snapshot.tokenAccounts
```

## Key Constants

- Default CLAWD mint: `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`
- CAAP protocol version: `1.0`
- Metaplex Agent Registry: `solana:101:metaplex`
- EIP-8004 schema: `https://eips.ethereum.org/EIPS/eip-8004#registration-v1`
- Tier thresholds: Free=0, Bronze=100K, Silver=500K, Gold=1M, Diamond=5M CLAWD
- Genesis API base: `https://api.metaplex.com`

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  CAAP/1.0 Protocol                    │
├──────────────────────────────────────────────────────┤
│  Phase 1: SIWS (Sign In With Solana)                 │
│  Phase 2: DAS Verification (Helius NFT check)        │
│  Phase 3: Token Attestation (CLAWD balance)          │
│  Phase 4: Subscription Tier (gating)                 │
├──────────────────────────────────────────────────────┤
│  Metaplex Agent Identity (Global On-Chain)            │
│  ├─ EIP-8004 Registration Document                   │
│  ├─ AgentIdentity PDA (discoverable)                 │
│  ├─ Asset Signer PDA (agent wallet, no private key)  │
│  ├─ Execution Delegate Record (off-chain operator)   │
│  └─ setAgentTokenV1 (permanent token binding)        │
├──────────────────────────────────────────────────────┤
│  Genesis Token Launch                                 │
│  ├─ Bonding Curve from Agent PDA                     │
│  ├─ Creator Fees → Agent PDA                         │
│  ├─ First Buy (fee-free)                             │
│  └─ Raydium CPMM Graduation                          │
└──────────────────────────────────────────────────────┘
```

## Live Demo

See [x402.wtf/agentauth](https://x402.wtf/agentauth) for a live interactive demo of CAAP/1.0.