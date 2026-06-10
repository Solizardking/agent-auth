// CAAP/1.0 Better Auth plugin — Clawd Agent Attestation Protocol
// Integrates SIWS, Metaplex Agent Registry, SPL 2022 token gating,
// and Agent OAuth into the Better Auth plugin system.
//
// This replaces the old plugin.ts with a full-featured version.

import type { AgentAuthSolanaConfig } from "./types";
import { attestAgent, fetchWalletSnapshot } from "./attestation";
import { computeTier } from "./subscription";
import {
  registerAgent as metaplexRegisterAgent,
  registerExecutive as metaplexRegisterExecutive,
  delegateAgentExecution as metaplexDelegateExecution,
  verifyAgentIdentity as metaplexVerifyAgentIdentity,
  findAgentsByOwner as metaplexFindAgentsByOwner,
  checkExecutionDelegation as metaplexCheckExecutionDelegation,
  buildAgentMetadata,
  type UmiConfig,
} from "./metaplex-agent";
import {
  checkTokenGate,
  validateSpl2022Mint,
} from "./spl2022";
import {
  verifyAgentSiws,
  createAgentOAuthSession,
  InMemoryAgentOAuthStore,
  validateAgentScopes,
  type AgentOAuthStore,
  type SiwsAgentVerification,
} from "./agent-oauth";
import type { SolanaSignInInput } from "./siws-impl";

const DEFAULT_CLAWD_MINT = "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump";

// ---------------------------------------------------------------------------
// Minimal Better Auth plugin shape
// ---------------------------------------------------------------------------

export interface MinimalPlugin {
  id: string;
  endpoints: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function createCaapPlugin(
  config: AgentAuthSolanaConfig = {},
): MinimalPlugin {
  const clawdMint = config.clawdMint ?? DEFAULT_CLAWD_MINT;
  const oauthStore: AgentOAuthStore = new InMemoryAgentOAuthStore();

  function getHeliusRpcUrl(): string {
    const apiKey = config.heliusApiKey ?? process.env.HELIUS_API_KEY ?? "";
    if (!apiKey) return "https://api.mainnet-beta.solana.com";
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }

  function getUmiConfig(): UmiConfig {
    return { rpcUrl: getHeliusRpcUrl() };
  }

  const rpcOpts = () => ({ heliusRpcUrl: getHeliusRpcUrl(), clawdMint });

  return {
    id: "caap-solana",
    endpoints: {
      // -----------------------------------------------------------------------
      // CAAP Attestation
      // -----------------------------------------------------------------------

      caapAttest: {
        method: "POST",
        path: "/caap/attest",
        async handler(ctx: { body: { agentId: string; walletAddress: string } }) {
          const { agentId, walletAddress } = ctx.body;
          if (!agentId || !walletAddress) {
            return { error: "agentId and walletAddress are required", status: 400 };
          }

          const [attestation, snapshot] = await Promise.allSettled([
            attestAgent(agentId, walletAddress, rpcOpts()),
            fetchWalletSnapshot(walletAddress, rpcOpts()),
          ]);

          const attestResult =
            attestation.status === "fulfilled"
              ? attestation.value
              : { verified: false, error: "attestation failed" };

          const snapshotResult =
            snapshot.status === "fulfilled" ? snapshot.value : null;

          const tierInfo = computeTier(snapshotResult?.clawdBalance ?? 0);

          return {
            caapVersion: "1.0",
            agentId,
            walletAddress,
            attestation: attestResult,
            snapshot: snapshotResult,
            tier: tierInfo,
          };
        },
      },

      caapStatus: {
        method: "GET",
        path: "/caap/status/:agentId",
        async handler(ctx: { params: { agentId: string }; query?: { wallet?: string } }) {
          const { agentId } = ctx.params;
          const wallet = ctx.query?.wallet;

          if (!wallet) {
            return {
              caapVersion: "1.0",
              agentId,
              status: "unverified",
              error: "wallet query param required",
            };
          }

          const result = await attestAgent(agentId, wallet, rpcOpts());

          return {
            caapVersion: "1.0",
            agentId,
            walletAddress: wallet,
            status: result.verified ? "verified" : "unverified",
            attestationHash: result.attestationHash,
            error: result.error,
          };
        },
      },

      caapDiscovery: {
        method: "GET",
        path: "/caap/discovery",
        handler() {
          return {
            protocol: "CAAP/1.0",
            version: "1.0",
            name: "Clawd Agent Attestation Protocol",
            description:
              "Solana-native agent identity, verification, and subscription protocol",
            network: "solana-mainnet",
            clawdMint,
            tiers: {
              free: 0,
              bronze: 100_000,
              silver: 500_000,
              gold: 1_000_000,
              diamond: 5_000_000,
            },
            features: {
              siws: true,
              dasAttestation: true,
              metaplexAgentRegistry: true,
              agentOAuth: true,
              spl2022TokenGating: true,
            },
            endpoints: {
              attest: "POST /caap/attest",
              status: "GET /caap/status/:agentId",
              discovery: "GET /caap/discovery",
              signIn: "POST /caap/sign-in",
              agents: "GET /caap/agents/:wallet",
              verifyAgent: "GET /caap/verify-agent/:agentAsset",
              oauthAuthorize: "GET /caap/oauth/authorize",
              tokenGate: "POST /caap/token-gate",
            },
            links: {
              docs: "https://x402.wtf/agentauth",
              spec: "https://x402.wtf/agentauth#paper",
              metaplex: "https://developers.metaplex.com/agents",
            },
          };
        },
      },

      // -----------------------------------------------------------------------
      // SIWS Sign-In (Agent OAuth)
      // -----------------------------------------------------------------------

      caapSignIn: {
        method: "POST",
        path: "/caap/sign-in",
        async handler(ctx: {
          body: {
            input: SolanaSignInInput;
            output: {
              account: { publicKey: number[] };
              signature: number[];
              signedMessage: number[];
            };
            clientId: string;
            scopes?: string;
          };
        }) {
          const { input, output, clientId, scopes } = ctx.body;
          if (!input || !output || !clientId) {
            return { error: "input, output, and clientId are required", status: 400 };
          }

          // 1. Verify SIWS + discover agent identity
          const verification = await verifyAgentSiws(
            input,
            output,
            undefined, // auto-discover agent
            getUmiConfig(),
          );

          if (!verification.siwsVerified) {
            return { error: "SIWS verification failed", status: 401 };
          }

          // 2. Validate requested scopes
          const requestedScopes = scopes ? scopes.split(" ") : ["wallet:read", "agent:identity"];
          const scopeValidation = validateAgentScopes(requestedScopes);
          if (!scopeValidation.valid) {
            return {
              error: `Invalid scopes: ${scopeValidation.invalid.join(", ")}`,
              status: 400,
            };
          }

          // 3. Create OAuth session
          const session = await createAgentOAuthSession(
            verification,
            clientId,
            scopeValidation.scopes,
            oauthStore,
          );

          return {
            success: true,
            sessionId: session.sessionId,
            walletAddress: session.walletAddress,
            agentAsset: session.agentAsset,
            agentVerified: session.agentVerified,
            scopes: session.scopes,
            expiresAt: session.expiresAt,
          };
        },
      },

      // -----------------------------------------------------------------------
      // Metaplex Agent Registry
      // -----------------------------------------------------------------------

      caapRegisterAgent: {
        method: "POST",
        path: "/caap/agents/register",
        async handler(ctx: {
          body: {
            assetPublicKey: string;
            collectionPublicKey: string;
            agentRegistrationUri: string;
          };
        }) {
          const { assetPublicKey, collectionPublicKey, agentRegistrationUri } = ctx.body;
          if (!assetPublicKey || !collectionPublicKey || !agentRegistrationUri) {
            return {
              error: "assetPublicKey, collectionPublicKey, and agentRegistrationUri are required",
              status: 400,
            };
          }

          try {
            const result = await metaplexRegisterAgent(
              assetPublicKey,
              collectionPublicKey,
              agentRegistrationUri,
              getUmiConfig(),
            );
            return { success: true, ...result };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "registration failed",
              status: 500,
            };
          }
        },
      },

      caapRegisterExecutive: {
        method: "POST",
        path: "/caap/executives/register",
        async handler(ctx: { body: { authority?: string } }) {
          const { authority } = ctx.body;
          try {
            const result = await metaplexRegisterExecutive(
              authority,
              getUmiConfig(),
            );
            return { success: true, ...result };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "executive registration failed",
              status: 500,
            };
          }
        },
      },

      caapDelegateExecution: {
        method: "POST",
        path: "/caap/executives/delegate",
        async handler(ctx: {
          body: { agentAsset: string; executiveAuthority: string };
        }) {
          const { agentAsset, executiveAuthority } = ctx.body;
          if (!agentAsset || !executiveAuthority) {
            return { error: "agentAsset and executiveAuthority are required", status: 400 };
          }

          try {
            const result = await metaplexDelegateExecution(
              agentAsset,
              executiveAuthority,
              getUmiConfig(),
            );
            return { success: true, ...result };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "delegation failed",
              status: 500,
            };
          }
        },
      },

      caapListAgents: {
        method: "GET",
        path: "/caap/agents/:wallet",
        async handler(ctx: { params: { wallet: string } }) {
          const { wallet } = ctx.params;
          if (!wallet) return { error: "wallet param is required", status: 400 };

          try {
            const agents = await metaplexFindAgentsByOwner(wallet, getUmiConfig());
            return { success: true, wallet, agents };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "failed to list agents",
              status: 500,
            };
          }
        },
      },

      caapVerifyAgent: {
        method: "GET",
        path: "/caap/verify-agent/:agentAsset",
        async handler(ctx: { params: { agentAsset: string } }) {
          const { agentAsset } = ctx.params;
          if (!agentAsset) return { error: "agentAsset param is required", status: 400 };

          try {
            const result = await metaplexVerifyAgentIdentity(agentAsset, getUmiConfig());
            return { success: true, agentAsset, ...result };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "verification failed",
              status: 500,
            };
          }
        },
      },

      // -----------------------------------------------------------------------
      // SPL 2022 Token Gating
      // -----------------------------------------------------------------------

      caapTokenGate: {
        method: "POST",
        path: "/caap/token-gate",
        async handler(ctx: {
          body: {
            walletAddress: string;
            requiredMint: string;
            minimumAmount: number;
          };
        }) {
          const { walletAddress, requiredMint, minimumAmount } = ctx.body;
          if (!walletAddress || !requiredMint || minimumAmount == null) {
            return {
              error: "walletAddress, requiredMint, and minimumAmount are required",
              status: 400,
            };
          }

          if (!validateSpl2022Mint(requiredMint)) {
            return { error: "Invalid SPL token mint format", status: 400 };
          }

          try {
            const result = await checkTokenGate(
              walletAddress,
              requiredMint,
              minimumAmount,
              getHeliusRpcUrl(),
            );
            return { success: true, ...result };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "token gate check failed",
              status: 500,
            };
          }
        },
      },

      // -----------------------------------------------------------------------
      // EIP-8004 Metadata Builder
      // -----------------------------------------------------------------------

      caapBuildMetadata: {
        method: "POST",
        path: "/caap/metadata/build",
        async handler(ctx: {
          body: {
            name: string;
            description?: string;
            image?: string;
            services?: Array<{ name: string; endpoint: string; version?: string; skills?: string[]; domains?: string[] }>;
            x402Support?: boolean;
            supportedTrust?: string[];
          };
        }) {
          const { name, description, image, services, x402Support, supportedTrust } = ctx.body;
          if (!name) return { error: "name is required", status: 400 };

          const metadata = buildAgentMetadata({
            name,
            description,
            image,
            services,
            x402Support,
            supportedTrust,
          });

          return { success: true, metadata };
        },
      },
    },
  };
}

// Re-export the old createCaapPlugin for backward compatibility
export { createCaapPlugin as caapPlugin };