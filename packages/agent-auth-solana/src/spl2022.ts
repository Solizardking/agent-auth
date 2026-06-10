// SPL Token 2022 support for agent identity tokens
// Token-gated agent operations using SPL 2022 tokens with metadata

import { createHash, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Spl2022TokenConfig {
  /** SPL 2022 token mint address */
  mint: string;
  /** Symbol for the token */
  symbol: string;
  /** Token name */
  name: string;
  /** Decimal places */
  decimals: number;
  /** Total supply */
  supply: number;
}

export interface AgentTokenBinding {
  /** The agent's on-chain asset address */
  agentAsset: string;
  /** The SPL 2022 token mint bound to this agent */
  tokenMint: string;
  /** Whether the binding is permanent (setAgentTokenV1 is permanent) */
  permanent: boolean;
  /** Hash of the binding for attestation */
  bindingHash: string;
}

export interface TokenBalanceResult {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  owner: string;
}

export interface TokenGatingResult {
  /** Whether the wallet has sufficient token balance */
  allowed: boolean;
  /** Required token amount */
  required: number;
  /** Current token balance */
  balance: number;
  /** Token symbol */
  symbol: string;
  /** Token mint address */
  mint: string;
}

// ---------------------------------------------------------------------------
// Agent token binding helpers
// ---------------------------------------------------------------------------

/**
 * Create a binding hash linking an agent asset to its token.
 * This mirrors the on-chain setAgentTokenV1 binding.
 */
export function createAgentTokenBindingHash(
  agentAsset: string,
  tokenMint: string,
): string {
  return createHash("sha256")
    .update(`agent-token-binding:${agentAsset}:${tokenMint}`)
    .digest("hex");
}

/**
 * Verify an agent-token binding hash.
 */
export function verifyAgentTokenBinding(
  proposedHash: string,
  agentAsset: string,
  tokenMint: string,
): boolean {
  const expected = createAgentTokenBindingHash(agentAsset, tokenMint);
  return proposedHash === expected;
}

// ---------------------------------------------------------------------------
// Token gating
// ---------------------------------------------------------------------------

/**
 * Check if a wallet meets the minimum token balance for gating.
 * Uses Helius DAS API to fetch token accounts by owner.
 */
export async function checkTokenGate(
  walletAddress: string,
  requiredMint: string,
  minimumAmount: number,
  rpcUrl: string,
): Promise<TokenGatingResult> {
  try {
    const balance = await getTokenBalance(walletAddress, requiredMint, rpcUrl);

    return {
      allowed: balance >= minimumAmount,
      required: minimumAmount,
      balance,
      symbol: "", // populated by getTokenInfo
      mint: requiredMint,
    };
  } catch (err) {
    return {
      allowed: false,
      required: minimumAmount,
      balance: 0,
      symbol: "",
      mint: requiredMint,
    };
  }
}

/**
 * Fetch token balance for a specific mint from an RPC endpoint.
 */
export async function getTokenBalance(
  walletAddress: string,
  mint: string,
  rpcUrl: string,
): Promise<number> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        walletAddress,
        { mint },
        { encoding: "jsonParsed" },
      ],
    }),
  });

  if (!res.ok) return 0;
  const json = await res.json();
  const accounts = json?.result?.value ?? [];
  if (accounts.length === 0) return 0;
  return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
}

/**
 * Validate an SPL 2022 token mint address format.
 * SPL 2022 uses the same base58 format as regular SPL tokens.
 */
export function validateSpl2022Mint(mint: string): boolean {
  if (!mint || mint.length < 32 || mint.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
}

/**
 * Check if a token account is an SPL Token 2022 account.
 * SPL 2022 program ID: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
 */
export function isSpl2022Program(programId: string): boolean {
  return programId === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
}

/**
 * Generate a deterministic nonce for SIWS with SPL 2022 binding.
 */
export function generateSpl2022Nonce(length = 16): string {
  return randomBytes(Math.ceil(length * 0.75))
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}