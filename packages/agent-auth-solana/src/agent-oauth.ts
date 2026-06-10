// Agent OAuth — SIWS-based OAuth for agent identity
// Bridges Sign In With Solana (SIWS) to OAuth 2.0 flows, binding
// the on-chain Metaplex agent identity to an OAuth session/access token.
//
// Flow:
//   1. Agent (or user) signs a SIWS message with their Solana wallet
//   2. Server verifies the SIWS signature via nacl
//   3. Server binds the wallet + Metaplex agent identity to an OAuth session
//   4. Returns an access token (JWT) with agent claims embedded

import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "crypto";
import { buildSiwsMessage } from "./siws-impl";
import type { SolanaSignInInput } from "./siws-impl";
import {
  verifyAgentIdentity,
  findAgentsByOwner,
} from "./metaplex-agent";
import type { UmiConfig } from "./metaplex-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentOAuthSession {
  /** Unique session ID */
  sessionId: string;
  /** Solana wallet address that signed */
  walletAddress: string;
  /** Metaplex agent asset (if verified) */
  agentAsset?: string;
  /** Whether the agent identity was verified on-chain */
  agentVerified: boolean;
  /** Agent name from registration metadata */
  agentName?: string;
  /** EIP-8004 metadata URI */
  agentMetadataUri?: string;
  /** OAuth scopes granted */
  scopes: string[];
  /** OAuth client ID (the dapp/agent requesting auth) */
  clientId: string;
  /** Session issued at */
  issuedAt: number;
  /** Session expiration */
  expiresAt: number;
  /** SIWS nonce used */
  nonce: string;
}

export interface AgentOAuthToken {
  /** OAuth 2.0 access token (JWT) */
  accessToken: string;
  /** Token type */
  tokenType: string;
  /** Expires in seconds */
  expiresIn: number;
  /** OAuth scopes */
  scope: string;
  /** Agent identity embedded in the token */
  agentSubject?: string;
}

export interface AgentOAuthRequest {
  /** OAuth client ID (the requesting dapp or agent) */
  clientId: string;
  /** Requested scopes (space-separated) */
  scope: string;
  /** Redirect URI */
  redirectUri?: string;
  /** State parameter for CSRF protection */
  state?: string;
}

export interface SiwsAgentVerification {
  /** Whether SIWS verification succeeded */
  siwsVerified: boolean;
  /** Whether the on-chain agent identity was verified */
  agentVerified: boolean;
  /** Verified wallet address */
  walletAddress: string;
  /** Agent asset address if verified */
  agentAsset?: string;
  /** SIWS nonce used */
  nonce: string;
}

export interface AgentScope {
  name: string;
  description: string;
  /** Permission level */
  level: "read" | "write" | "admin" | "execute";
}

// ---------------------------------------------------------------------------
// Standard agent scopes
// ---------------------------------------------------------------------------

export const AGENT_SCOPES: Record<string, AgentScope> = {
  "agent:identity": {
    name: "Agent Identity",
    description: "Read agent on-chain identity and metadata",
    level: "read",
  },
  "agent:execute": {
    name: "Agent Execution",
    description: "Execute transactions on behalf of the agent",
    level: "execute",
  },
  "agent:balance": {
    name: "Agent Balance",
    description: "Read agent token balances",
    level: "read",
  },
  "agent:admin": {
    name: "Agent Admin",
    description: "Administer agent settings and delegation",
    level: "admin",
  },
  "wallet:read": {
    name: "Wallet Read",
    description: "Read wallet address and public key",
    level: "read",
  },
  "siws:sign": {
    name: "SIWS Sign",
    description: "Request SIWS signature verification",
    level: "read",
  },
};

export const VALID_AGENT_SCOPES = Object.keys(AGENT_SCOPES);

// ---------------------------------------------------------------------------
// Session storage interface
// ---------------------------------------------------------------------------

export interface AgentOAuthStore {
  createSession(session: AgentOAuthSession): Promise<void>;
  getSession(sessionId: string): Promise<AgentOAuthSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessionsByWallet(walletAddress: string): Promise<AgentOAuthSession[]>;
}

// ---------------------------------------------------------------------------
// In-memory store (default)
// ---------------------------------------------------------------------------

export class InMemoryAgentOAuthStore implements AgentOAuthStore {
  private sessions = new Map<string, AgentOAuthSession>();
  private walletIndex = new Map<string, Set<string>>();

  async createSession(session: AgentOAuthSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
    const walletSessions = this.walletIndex.get(session.walletAddress) ?? new Set();
    walletSessions.add(session.sessionId);
    this.walletIndex.set(session.walletAddress, walletSessions);
  }

  async getSession(sessionId: string): Promise<AgentOAuthSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      const walletSessions = this.walletIndex.get(session.walletAddress);
      if (walletSessions) {
        walletSessions.delete(sessionId);
        if (walletSessions.size === 0) {
          this.walletIndex.delete(session.walletAddress);
        }
      }
    }
  }

  async listSessionsByWallet(walletAddress: string): Promise<AgentOAuthSession[]> {
    const sessionIds = this.walletIndex.get(walletAddress);
    if (!sessionIds) return [];
    return [...sessionIds]
      .map((id) => this.sessions.get(id))
      .filter((s): s is AgentOAuthSession => s !== undefined);
  }
}

// ---------------------------------------------------------------------------
// Agent verification with SIWS
// ---------------------------------------------------------------------------

/**
 * Verify a SIWS signature and optionally verify the agent's
 * on-chain Metaplex identity in one step.
 */
export async function verifyAgentSiws(
  input: SolanaSignInInput,
  output: {
    account: { publicKey: Uint8Array | number[] };
    signature: Uint8Array | number[];
    signedMessage: Uint8Array | number[];
  },
  agentAssetPublicKey?: string,
  umiConfig?: UmiConfig,
): Promise<SiwsAgentVerification> {
  // 1. SIWS verification (message structure + ed25519 signature)
  const publicKey = toUint8Array(output.account.publicKey);
  const signature = toUint8Array(output.signature);
  const signedMessage = toUint8Array(output.signedMessage);

  const expectedMessage = buildSiwsMessage(input);
  const decoded = new TextDecoder().decode(signedMessage);
  const siwsVerified = decoded === expectedMessage &&
    nacl.sign.detached.verify(signedMessage, signature, publicKey);

  const walletAddress = bs58.encode(publicKey);

  // 2. On-chain agent identity verification
  let agentVerified = false;
  let agentAsset = agentAssetPublicKey;

  if (agentAssetPublicKey) {
    const result = await verifyAgentIdentity(agentAssetPublicKey, umiConfig);
    agentVerified = result.verified;
  } else {
    // Auto-discover: find the first agent owned by this wallet
    const agents = await findAgentsByOwner(walletAddress, umiConfig);
    if (agents.length > 0) {
      agentAsset = agents[0].asset;
      agentVerified = true;
    }
  }

  return {
    siwsVerified,
    agentVerified,
    walletAddress,
    agentAsset,
    nonce: input.nonce ?? "",
  };
}

/**
 * Create an OAuth session after successful SIWS + agent verification.
 * This binds the Solana wallet + Metaplex agent to an OAuth session.
 */
export async function createAgentOAuthSession(
  verification: SiwsAgentVerification,
  clientId: string,
  scopes: string[],
  store: AgentOAuthStore,
  sessionDurationMs = 3600_000, // 1 hour default
): Promise<AgentOAuthSession> {
  const now = Date.now();
  const session: AgentOAuthSession = {
    sessionId: createHash("sha256")
      .update(`${verification.walletAddress}:${clientId}:${now}:${verification.nonce}`)
      .digest("hex")
      .slice(0, 32),
    walletAddress: verification.walletAddress,
    agentAsset: verification.agentAsset,
    agentVerified: verification.agentVerified,
    scopes: scopes.filter((s) => VALID_AGENT_SCOPES.includes(s)),
    clientId,
    issuedAt: now,
    expiresAt: now + sessionDurationMs,
    nonce: verification.nonce,
  };

  await store.createSession(session);
  return session;
}

/**
 * Validate OAuth scopes requested by a client against allowed scopes.
 */
export function validateAgentScopes(requestedScopes: string[]): {
  valid: boolean;
  scopes: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const scope of requestedScopes) {
    if (VALID_AGENT_SCOPES.includes(scope)) {
      valid.push(scope);
    } else {
      invalid.push(scope);
    }
  }

  return {
    valid: invalid.length === 0,
    scopes: valid,
    invalid,
  };
}

/**
 * Generate an OAuth authorization endpoint URL for agent SIWS flow.
 */
export function buildAgentAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  walletAddress: string,
  agentAsset?: string,
  scopes?: string[],
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    wallet_address: walletAddress,
  });

  if (agentAsset) params.set("agent_asset", agentAsset);
  if (scopes?.length) params.set("scope", scopes.join(" "));

  return `?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toUint8Array(value: Uint8Array | number[]): Uint8Array {
  return value instanceof Uint8Array ? value : Uint8Array.from(value);
}