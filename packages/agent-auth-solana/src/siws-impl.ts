// SIWS (Sign In With Solana) implementation using nacl + bs58.
// Full ABNF compliance per the SIWS specification.
// Supports: domain, address, statement, uri, version, chainId, nonce,
// issuedAt, expirationTime, notBefore, requestId, resources.

import nacl from "tweetnacl";
import bs58 from "bs58";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolanaSignInInput {
  domain?: string;
  address?: string;
  statement?: string;
  uri?: string;
  version?: string;
  chainId?: string;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export interface SolanaSignInOutput {
  account: {
    publicKey: Uint8Array;
    address?: string;
  };
  signedMessage: Uint8Array;
  signature: Uint8Array;
  signatureType?: "ed25519";
}

// ---------------------------------------------------------------------------
// Supported chain IDs
// ---------------------------------------------------------------------------

export const SUPPORTED_CHAIN_IDS = [
  "mainnet",
  "testnet",
  "devnet",
  "localnet",
  "solana:mainnet",
  "solana:testnet",
  "solana:devnet",
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

// ---------------------------------------------------------------------------
// Message construction (ABNF-compliant)
// ---------------------------------------------------------------------------

/**
 * Build a SIWS message string following the ABNF format:
 *
 * sign-in-with-solana =
 *   message-domain %s" wants you to sign in with your Solana account:" LF
 *   message-address
 *   [ LF LF message-statement ]
 *   [ LF advanced-fields ]
 *
 * advanced-fields = [ fields... ]
 *
 * See: https://github.com/phantom/sign-in-with-solana/tree/main
 */
export function buildSiwsMessage(input: SolanaSignInInput): string {
  // Domain and address are mandatory for the constructed message
  const domain = input.domain ?? "";
  const address = input.address ?? "";

  const lines: string[] = [];

  // Line 1: "${domain} wants you to sign in with your Solana account:"
  if (domain) {
    lines.push(`${domain} wants you to sign in with your Solana account:`);
  } else {
    lines.push("This domain wants you to sign in with your Solana account:");
  }

  // Line 2: ${address}
  lines.push(address);

  // Empty line then statement (if provided)
  if (input.statement) {
    lines.push("");
    lines.push(input.statement);
  }

  // Advanced fields
  const fields: string[] = [];
  if (input.uri) fields.push(`URI: ${input.uri}`);
  if (input.version) fields.push(`Version: ${input.version}`);
  if (input.chainId) fields.push(`Chain ID: ${input.chainId}`);
  if (input.nonce) fields.push(`Nonce: ${input.nonce}`);
  if (input.issuedAt) fields.push(`Issued At: ${input.issuedAt}`);
  if (input.expirationTime) fields.push(`Expiration Time: ${input.expirationTime}`);
  if (input.notBefore) fields.push(`Not Before: ${input.notBefore}`);
  if (input.requestId) fields.push(`Request ID: ${input.requestId}`);

  if (input.resources && input.resources.length > 0) {
    fields.push("Resources:");
    for (const resource of input.resources) {
      fields.push(`- ${resource}`);
    }
  }

  if (fields.length > 0) {
    lines.push("");
    lines.push(fields.join("\n"));
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Input generation
// ---------------------------------------------------------------------------

function randomBase58Nonce(len = 16): string {
  const bytes = nacl.randomBytes(Math.ceil(len * 0.75));
  return bs58.encode(bytes).slice(0, len);
}

/**
 * Create a SIWS sign-in input object with sensible defaults.
 * All fields are optional per the spec.
 */
export function createSiwsInput(opts?: {
  address?: string;
  nonce?: string;
  domain?: string;
  uri?: string;
  statement?: string;
  chainId?: SupportedChainId;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}): SolanaSignInInput {
  const domain = opts?.domain ?? "clawd.xyz";
  const uri = opts?.uri ?? `https://${domain}`;

  return {
    domain,
    address: opts?.address,
    statement:
      opts?.statement ??
      "Sign in to Clawd. This request will not trigger a blockchain transaction or cost any gas fees.",
    uri,
    version: "1",
    chainId: opts?.chainId ?? "mainnet",
    nonce: opts?.nonce ?? randomBase58Nonce(16),
    issuedAt: opts?.issuedAt ?? new Date().toISOString(),
    expirationTime: opts?.expirationTime,
    notBefore: opts?.notBefore,
    requestId: opts?.requestId,
    resources: opts?.resources,
  };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function toUint8Array(value: Uint8Array | number[]): Uint8Array {
  return value instanceof Uint8Array ? value : Uint8Array.from(value);
}

/**
 * Verify a SIWS sign-in output against the input.
 * Checks:
 *   - The signed message matches the expected ABNF format
 *   - The ed25519 signature verifies against the message
 */
export function verifySiws(
  input: SolanaSignInInput,
  output: {
    account: { publicKey: Uint8Array | number[] };
    signature: Uint8Array | number[];
    signedMessage: Uint8Array | number[];
  },
): boolean {
  try {
    const publicKey = toUint8Array(output.account.publicKey);
    const signature = toUint8Array(output.signature);
    const signedMessage = toUint8Array(output.signedMessage);

    // 1. Verify the message structure matches the ABNF format
    const expectedMessage = buildSiwsMessage(input);
    const decoded = new TextDecoder().decode(signedMessage);
    if (decoded !== expectedMessage) return false;

    // 2. Verify the ed25519 signature
    return nacl.sign.detached.verify(signedMessage, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Verify a raw Solana signature (message string + base58 signature + base58 public key).
 * This is the legacy verification approach, kept for backward compatibility.
 */
export function verifySolanaSignature(
  message: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Parse a SIWS message string back into its component fields.
 * Useful for extracting ABNF fields from a signed message for verification.
 */
export function parseSiwsMessage(message: string): {
  domain?: string;
  address?: string;
  statement?: string;
  fields: Record<string, string | string[]>;
} {
  const lines = message.split("\n");
  const fields: Record<string, string | string[]> = {};

  // First line: "${domain} wants you to sign in with your Solana account:"
  const domainMatch = lines[0]?.match(/^(.+?) wants you to sign in with your Solana account:$/);
  const domain = domainMatch?.[1];

  // Second line: address
  const address = lines[1]?.trim();

  // Find the statement (between empty lines after address and before fields)
  let statement: string | undefined;
  let inFields = false;
  const resourceLines: string[] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];

    if (!inFields) {
      if (line === "") {
        inFields = true;
        continue;
      }
      statement = statement ? `${statement}\n${line}` : line;
      continue;
    }

    // Parse fields
    if (line.startsWith("URI: ")) fields.uri = line.slice(5);
    else if (line.startsWith("Version: ")) fields.version = line.slice(9);
    else if (line.startsWith("Chain ID: ")) fields.chain_id = line.slice(10);
    else if (line.startsWith("Nonce: ")) fields.nonce = line.slice(7);
    else if (line.startsWith("Issued At: ")) fields.issued_at = line.slice(11);
    else if (line.startsWith("Expiration Time: ")) fields.expiration_time = line.slice(17);
    else if (line.startsWith("Not Before: ")) fields.not_before = line.slice(12);
    else if (line.startsWith("Request ID: ")) fields.request_id = line.slice(12);
    else if (line.startsWith("- ")) resourceLines.push(line.slice(2));
    else if (line === "Resources:") continue;
  }

  if (resourceLines.length > 0) fields.resources = resourceLines;

  return { domain, address, statement, fields };
}

export { buildSiwsMessage as createSignInMessageText };