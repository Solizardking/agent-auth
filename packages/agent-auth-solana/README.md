# @clawd/agent-auth-solana

Solana-native agent authentication, on-chain identity, and token launch for the Clawd platform. Implements the **Clawd Agent Attestation Protocol (CAAP/1.0)** — SIWS sign-in, Helius DAS verification, CLAWD token balance checking, subscription tier logic, **Metaplex Agent Registry integration (EIP-8004)**, and **Genesis bonding curve token launches**.

## Install

```bash
npm install @clawd/agent-auth-solana
# peer deps:
npm install better-auth better-auth-solana
```

## Quick Start

### Server — Better Auth setup

```ts
import { betterAuth } from "better-auth";
import { siws } from "better-auth-solana";
import { createCaapPlugin } from "@clawd/agent-auth-solana";

export const auth = betterAuth({
  plugins: [
    siws(),
    createCaapPlugin({
      heliusApiKey: process.env.HELIUS_API_KEY,
      clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
      enableSubscriptionTiers: true,
      enableDasAttestation: true,
      identityRpcUrl: process.env.SOLANA_RPC_URL,  // optional, for identity verification
    }),
  ],
});
```

### Client — SIWS sign-in

```ts
import { createSiwsMessage, encodeSiwsForSubmit, generateNonce } from "@clawd/agent-auth-solana/client";

const nonce = generateNonce();
const message = createSiwsMessage({
  address: walletPublicKey,
  domain: window.location.hostname,
  nonce,
});

const { signature } = await wallet.signMessage(new TextEncoder().encode(message));
const payload = encodeSiwsForSubmit(message, signature, walletPublicKey);
// POST payload to /api/auth/sign-in/siws
```

### Server — Attestation

```ts
import { attestAgent, fetchWalletSnapshot, computeTier } from "@clawd/agent-auth-solana";

const opts = {
  heliusRpcUrl: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
};

const attestation = await attestAgent(agentId, walletAddress, opts);
const snapshot = await fetchWalletSnapshot(walletAddress, opts);
const tier = computeTier(snapshot.clawdBalance);
```

### Agent Identity — Metaplex Agent Registry (EIP-8004)

Register a globally discoverable on-chain agent identity bound to an MPL Core asset.

```ts
import {
  buildEip8004Registration,
  buildRegisterIdentityParams,
  deriveAssetSignerPda,
} from "@clawd/agent-auth-solana";

// Build the EIP-8004 registration document
const doc = buildEip8004Registration({
  name: "My Agent",
  description: "An autonomous agent that executes DeFi strategies on Solana.",
  image: "https://arweave.net/agent-avatar-tx-hash",
  assetPublicKey: agentAssetAddress,
  services: [
    { name: "A2A", endpoint: "https://myagent.com/agent-card.json", version: "0.3.0" },
    { name: "MCP", endpoint: "https://myagent.com/mcp", version: "2025-06-18" },
  ],
  supportedTrust: ["reputation", "crypto-economic"],
  x402Support: true,
});

// Derive the agent's Asset Signer PDA wallet (no private key)
const agentWallet = deriveAssetSignerPda(agentAssetAddress);

// Build registration params → pass to @metaplex-foundation/mpl-agent-registry
const params = buildRegisterIdentityParams({
  asset: agentAssetAddress,
  collection: collectionAddress,
  agentRegistrationUri: "https://arweave.net/registration-json-hash",
});
```

### Token Launch — Genesis Bonding Curve

Launch an agent token from the Asset Signer PDA with permanent token-agent binding.

```ts
import { buildGenesisLaunchInput, validateGenesisLaunchInput } from "@clawd/agent-auth-solana";

const input = buildGenesisLaunchInput({
  agentAsset: agentAssetAddress,
  setToken: true,        // IRREVERSIBLE — permanent token-agent binding
  payer: payerWallet,
  tokenName: "Agent Token",
  tokenSymbol: "AGT",
  tokenImage: "https://gateway.irys.xyz/your-image-id",
  tokenDescription: "The official token of my agent",
  firstBuyAmount: 0.1,   // 0.1 SOL fee-free first buy
});

const errors = validateGenesisLaunchInput(input);
// → pass to @metaplex-foundation/genesis/api:
// await createAndRegisterLaunch(umi, {}, input).sendAndConfirm(umi);
```

## Protocol

CAAP/1.0 defines six verification phases:

1. **SIWS** — Sign In With Solana (EIP-4361-style for Solana)
2. **DAS Verification** — Helius DAS API checks for agent NFTs in the wallet
3. **Token Attestation** — CLAWD SPL token balance check via `getTokenAccountsByOwner`
4. **Subscription Tier** — Balance maps to Free / Bronze / Silver / Gold / Diamond
5. **On-Chain Identity** — Metaplex Agent Registry (EIP-8004), AgentIdentity PDA, Asset Signer PDA, Execution Delegation
6. **Token Launch** — Genesis bonding curve from agent PDA, permanent setAgentTokenV1 binding, Raydium CPMM graduation

See the full spec at [x402.wtf/agentauth](https://x402.wtf/agentauth).

## Tiers

| Tier    | CLAWD Required |
|---------|---------------|
| Free    | 0             |
| Bronze  | 100,000       |
| Silver  | 500,000       |
| Gold    | 1,000,000     |
| Diamond | 5,000,000     |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/caap/attest` | POST | Full attestation + wallet snapshot + tier |
| `/caap/status/:agentId` | GET | Lightweight verified/unverified check |
| `/caap/discovery` | GET | CAAP/1.0 protocol discovery document |
| `/agent/identity/register` | POST | Build EIP-8004 doc + registerIdentityV1 params |
| `/agent/identity/verify/:asset` | GET | Check on-chain Metaplex Agent Registry registration |
| `/agent/identity/delegate` | POST | Build delegateExecutionV1 params |
| `/agent/token/set` | POST | Build setAgentTokenV1 params (irreversible binding) |
| `/agent/token/launch` | POST | Build Genesis bonding curve launch input with validation |

## Related SDKs

| SDK | Use |
|---|---|
| `@metaplex-foundation/mpl-agent-registry` | Register identity, delegate execution, set agent token |
| `@metaplex-foundation/mpl-core` | Create Core asset, derive Asset Signer PDA, Execute hook |
| `@metaplex-foundation/genesis` | Launch bonding curve token from agent PDA |
| `better-auth-solana` | SIWS wallet authentication |

## License

MIT — Clawd Labs, 2026