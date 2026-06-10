import type { SubscriptionTier } from "./subscription";

export interface AgentAuthSolanaConfig {
  clawdMint?: string;
  heliusApiKey?: string;
  enableSubscriptionTiers?: boolean;
  enableDasAttestation?: boolean;
  requireVerifiedAgent?: boolean;

  /** Enable Metaplex Agent Registry integration */
  enableMetaplexAgentRegistry?: boolean;
  /** Enable Agent OAuth bridging */
  enableAgentOAuth?: boolean;
  /** Enable SPL 2022 token gating */
  enableSpl2022TokenGating?: boolean;
  /** Default Solana RPC URL */
  rpcUrl?: string;
}

export interface VerifiedAgentSession {
  walletAddress: string;
  agentId?: string;
  verified: boolean;
  tier: SubscriptionTier;
  clawdBalance: number;
  solBalance: number;
  attestationHash?: string;

  /** Metaplex agent asset if verified */
  agentAsset?: string;
  /** Agent identity PDA */
  agentIdentityPda?: string;
  /** Whether agent has on-chain identity */
  agentRegistered?: boolean;
  /** Agent metadata URI (EIP-8004) */
  agentMetadataUri?: string;
  /** Agent OAuth session ID */
  oauthSessionId?: string;
  /** OAuth scopes granted */
  oauthScopes?: string[];
}

export interface AgentAuthEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  requiresAuth?: boolean;
}

export interface CaapProtocolDocument {
  protocol: string;
  version: string;
  name: string;
  description: string;
  network: string;
  clawdMint: string;
  tiers: Record<string, number>;
  features: Record<string, boolean>;
  endpoints: Record<string, string>;
  links: Record<string, string>;
}