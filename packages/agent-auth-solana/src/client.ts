// Client-side CAAP helpers — safe to import in browser/React components.
// Provides browser-safe SIWS message building, Wallet Standard integration,
// and nonce generation for Sign In With Solana.

import { buildSiwsMessage } from "./siws-impl";
import type { SolanaSignInInput } from "./siws-impl";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SiwsMessageOpts {
  address: string;
  domain: string;
  nonce: string;
  statement?: string;
  uri?: string;
  chainId?: string;
  version?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export interface SiwsSignInResult {
  /** The SIWS message that was signed */
  message: string;
  /** The message as a Uint8Array */
  messageBytes: Uint8Array;
  /** The base58-encoded signature */
  signature: string;
  /** The base58-encoded public key / wallet address */
  publicKey: string;
  /** The raw signature bytes */
  signatureBytes: Uint8Array;
}

// ---------------------------------------------------------------------------
// Message building
// ---------------------------------------------------------------------------

/**
 * Build the SIWS sign-in message string that should be shown to the user
 * and passed to Phantom/Backpack/any Solana wallet for signing.
 * Supports all SIWS fields per the ABNF spec.
 */
export function createSiwsMessage(opts: SiwsMessageOpts): string {
  return buildSiwsMessage({
    domain: opts.domain,
    address: opts.address,
    statement:
      opts.statement ??
      "Sign in to Clawd. This request will not trigger a blockchain transaction or cost any gas fees.",
    uri: opts.uri ?? `https://${opts.domain}`,
    version: opts.version ?? "1",
    chainId: opts.chainId ?? "mainnet",
    nonce: opts.nonce,
    issuedAt: opts.issuedAt ?? new Date().toISOString(),
    expirationTime: opts.expirationTime,
    notBefore: opts.notBefore,
    requestId: opts.requestId,
    resources: opts.resources,
  });
}

// ---------------------------------------------------------------------------
// Wallet Standard signIn feature helpers
// ---------------------------------------------------------------------------

/**
 * Check if a wallet adapter supports the Wallet Standard signIn feature.
 * Use this before calling adapter.signIn() to fall back to connect + signMessage.
 */
export function supportsSignIn(
  adapter: { signIn?: unknown } | Record<string, unknown>,
): boolean {
  return typeof (adapter as { signIn?: unknown }).signIn === "function";
}

/**
 * Sign in with Solana using the Wallet Standard signIn feature.
 * If the adapter supports signIn, use it directly.
 * Otherwise, fall back to connect + signMessage.
 */
export async function signInWithSolana(
  adapter: {
    connect?: () => Promise<{ publicKey: { toString: () => string } }>;
    signIn?: (input: SolanaSignInInput) => Promise<{
      account: { publicKey: Uint8Array; address?: string };
      signature: Uint8Array;
      signedMessage: Uint8Array;
    }>;
    publicKey?: { toString: () => string };
    signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  },
  input: SolanaSignInInput,
): Promise<SiwsSignInResult> {
  // If the adapter supports signIn, use it (Wallet Standard)
  if (typeof adapter.signIn === "function") {
    const output = await adapter.signIn(input);

    const publicKey = output.account.publicKey;
    const pkStr = output.account.address ?? arrayToBase58(publicKey);
    const sigStr = arrayToBase58(output.signature);

    return {
      message: new TextDecoder().decode(output.signedMessage),
      messageBytes: output.signedMessage,
      signature: sigStr,
      publicKey: pkStr,
      signatureBytes: output.signature,
    };
  }

  // Fallback: connect + signMessage (legacy flow)
  if (adapter.connect) {
    await adapter.connect();
  }

  const pkStr = adapter.publicKey?.toString();
  if (!pkStr) throw new Error("Wallet not connected");

  // Build the SIWS message
  const message = buildSiwsMessage({ ...input, address: pkStr });
  const messageBytes = new TextEncoder().encode(message);

  // Sign the message
  if (!adapter.signMessage) throw new Error("Wallet does not support signMessage");
  const signatureBytes = await adapter.signMessage(messageBytes);
  const sigStr = arrayToBase58(signatureBytes);

  return {
    message,
    messageBytes,
    signature: sigStr,
    publicKey: pkStr,
    signatureBytes,
  };
}

// ---------------------------------------------------------------------------
// Encoding / serialization
// ---------------------------------------------------------------------------

/**
 * Encode the signed SIWS message and signature for POST to /caap/sign-in or
 * the better-auth-solana sign-in endpoint.
 */
export function encodeSiwsForSubmit(
  message: string,
  signature: string | Uint8Array,
  walletAddress: string,
): { message: string; signature: string; walletAddress: string } {
  const sigStr =
    typeof signature === "string" ? signature : arrayToBase58(signature);

  return { message, signature: sigStr, walletAddress };
}

/**
 * Encode a SIWS result for submitting to the CAAP sign-in endpoint.
 */
export function encodeSiwsForCaap(
  result: SiwsSignInResult,
): {
  message: string;
  signature: string;
  walletAddress: string;
  publicKey: string;
} {
  return {
    message: result.message,
    signature: result.signature,
    walletAddress: result.publicKey,
    publicKey: result.publicKey,
  };
}

// ---------------------------------------------------------------------------
// Nonce generation
// ---------------------------------------------------------------------------

/**
 * Generate a random base58 nonce for use in SIWS messages.
 * Uses crypto.getRandomValues() in browser environments.
 */
export function generateNonce(length = 16): string {
  const bytes = new Uint8Array(Math.ceil(length * 0.75));
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Simple base58 encoding for browser compatibility
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(
    "0x" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  );
  let result = "";
  while (value > 0n) {
    result = ALPHABET[Number(value % 58n)] + result;
    value = value / 58n;
  }
  return result.slice(0, length).padStart(length, "1");
}

// ---------------------------------------------------------------------------
// Metaplex Agent + SIWS integration for the client side
// ---------------------------------------------------------------------------

/**
 * Build an authorization URL for the CAAP agent OAuth flow.
 * Use this on the client to redirect the user to sign in with their wallet.
 */
export function buildCaapAuthorizationUrl(
  baseUrl: string,
  clientId: string,
  redirectUri: string,
  state: string,
  walletAddress?: string,
  agentAsset?: string,
  scopes?: string[],
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  if (walletAddress) params.set("wallet_address", walletAddress);
  if (agentAsset) params.set("agent_asset", agentAsset);
  if (scopes?.length) params.set("scope", scopes.join(" "));

  return `${baseUrl}/caap/sign-in?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function arrayToBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(
    "0x" +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  );
  let result = "";
  while (value > 0n) {
    result = ALPHABET[Number(value % 58n)] + result;
    value = value / 58n;
  }
  return result || ALPHABET[0];
}