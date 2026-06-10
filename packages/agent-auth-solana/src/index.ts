// CAAP: Clawd Agent Attestation Protocol v1.0
// Solana-native agent identity, verification, and subscription protocol

export const CAAP_VERSION = "1.0";
export const CAAP_PROTOCOL = "CAAP/1.0";

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type { AttestationResult, WalletSnapshot } from "./attestation";
export type { SubscriptionTier, TierInfo } from "./subscription";
export type { AgentAuthSolanaConfig, VerifiedAgentSession } from "./types";
export type {
  SolanaSignInInput,
  SolanaSignInOutput,
  SupportedChainId,
} from "./siws-impl";

// Metaplex Agent Registry types
export type {
  AgentRegistrationInput,
  RegisteredAgentInfo,
  ExecutiveProfileInfo,
  DelegationInfo,
  AgentMetadataDocument,
  AgentService,
  CrossRegistryRegistration,
  UmiConfig,
} from "./metaplex-agent";

// SPL 2022 types
export type {
  Spl2022TokenConfig,
  AgentTokenBinding,
  TokenBalanceResult,
  TokenGatingResult,
} from "./spl2022";

// Agent OAuth types
export type {
  AgentOAuthSession,
  AgentOAuthToken,
  AgentOAuthRequest,
  SiwsAgentVerification,
  AgentScope,
  AgentOAuthStore,
} from "./agent-oauth";

// ---------------------------------------------------------------------------
// Function exports
// ---------------------------------------------------------------------------

// Attestation
export { attestAgent, fetchWalletSnapshot } from "./attestation";

// Subscription tiers
export {
  computeTier,
  detectSell,
  tierBadgeColor,
  tierLabel,
  TIER_THRESHOLDS,
} from "./subscription";

// SIWS
export {
  verifySiws,
  verifySolanaSignature,
  createSiwsInput,
  buildSiwsMessage,
  createSignInMessageText,
  parseSiwsMessage,
} from "./siws-impl";

// Metaplex Agent Registry
export {
  registerAgent,
  registerExecutive,
  delegateAgentExecution,
  findAgentsByOwner,
  verifyAgentIdentity,
  checkExecutionDelegation,
  buildAgentMetadata,
  fetchAgentMetadata,
  findAgentIdentityV1Pda,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
} from "./metaplex-agent";

// SPL 2022
export {
  checkTokenGate,
  getTokenBalance,
  createAgentTokenBindingHash,
  verifyAgentTokenBinding,
  validateSpl2022Mint,
  isSpl2022Program,
  generateSpl2022Nonce,
} from "./spl2022";

// Agent OAuth
export {
  verifyAgentSiws,
  createAgentOAuthSession,
  InMemoryAgentOAuthStore,
  validateAgentScopes,
  buildAgentAuthorizationUrl,
  AGENT_SCOPES,
  VALID_AGENT_SCOPES,
} from "./agent-oauth";

// Plugin (backward-compatible)
export { createCaapPlugin } from "./caap-plugin";

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

export const CAAP_ENDPOINTS = {
  attest: "POST /caap/attest",
  status: "GET /caap/status/:agentId",
  discovery: "GET /caap/discovery",
  signIn: "POST /caap/sign-in",
  registerAgent: "POST /caap/agents/register",
  registerExecutive: "POST /caap/executives/register",
  delegateExecution: "POST /caap/executives/delegate",
  listAgents: "GET /caap/agents/:wallet",
  verifyAgent: "GET /caap/verify-agent/:agentAsset",
  tokenGate: "POST /caap/token-gate",
  buildMetadata: "POST /caap/metadata/build",
} as const;

export const DEFAULT_CLAWD_MINT = "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump";