// Metaplex Agent Registry integration
// On-chain agent identity, registration, execution delegation, and discovery
// using @metaplex-foundation/mpl-agent-registry and EIP-8004 metadata.

import {
  createUmi,
} from "@metaplex-foundation/umi-bundle-defaults";
import {
  publicKey,
  type Umi,
} from "@metaplex-foundation/umi";
import {
  mplAgentIdentity,
  mplAgentTools,
  registerIdentityV1,
  registerExecutiveV1,
  delegateExecutionV1,
  findAgentIdentityV1Pda,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
} from "@metaplex-foundation/mpl-agent-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentRegistrationInput {
  name: string;
  description?: string;
  agentRegistrationUri: string;
  collection: string;
}

export interface RegisteredAgentInfo {
  asset: string;
  collection: string;
  name: string;
  uri: string;
  identityPda: string;
}

export interface ExecutiveProfileInfo {
  authority: string;
  profilePda: string;
}

export interface DelegationInfo {
  agentAsset: string;
  executiveAuthority: string;
  delegateRecordPda: string;
  exists: boolean;
}

export interface AgentMetadataDocument {
  type: string;
  name: string;
  description: string;
  image?: string;
  services?: AgentService[];
  x402Support?: boolean;
  active?: boolean;
  registrations?: CrossRegistryRegistration[];
  supportedTrust?: string[];
}

export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
  skills?: string[];
  domains?: string[];
}

export interface CrossRegistryRegistration {
  agentId: string;
  agentRegistry: string;
}

export interface UmiConfig {
  rpcUrl?: string;
  signer?: {
    secretKey: Uint8Array;
    publicKey?: string;
  };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const EIP_8004_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

// ---------------------------------------------------------------------------
// UMI helpers
// ---------------------------------------------------------------------------

function createUmiInstance(config?: UmiConfig): Umi {
  const rpc = config?.rpcUrl ?? DEFAULT_RPC;
  let umi = createUmi(rpc).use(mplAgentIdentity()).use(mplAgentTools());

  if (config?.signer) {
    const keypair = umi.eddsa.createKeypairFromSecretKey(
      config.signer.secretKey,
    );
    umi = umi.use({
      async install(context) {
        context.payer = keypair;
      },
    });
  }

  return umi;
}

// ---------------------------------------------------------------------------
// Agent Registration
// ---------------------------------------------------------------------------

export async function registerAgent(
  assetPublicKey: string,
  collectionPublicKey: string,
  agentRegistrationUri: string,
  config?: UmiConfig,
): Promise<RegisteredAgentInfo> {
  const umi = createUmiInstance(config);
  const asset = publicKey(assetPublicKey);
  const collection = publicKey(collectionPublicKey);

  await registerIdentityV1(umi, {
    asset,
    collection,
    agentRegistrationUri,
  }).sendAndConfirm(umi);

  const identityPda = findAgentIdentityV1Pda(umi, { asset });

  return {
    asset: assetPublicKey,
    collection: collectionPublicKey,
    name: "",
    uri: agentRegistrationUri,
    identityPda: identityPda.toString(),
  };
}

export async function registerExecutive(
  authorityPublicKey?: string,
  config?: UmiConfig,
): Promise<ExecutiveProfileInfo> {
  const umi = createUmiInstance(config);
  const authority = authorityPublicKey
    ? publicKey(authorityPublicKey)
    : umi.payer.publicKey;

  await registerExecutiveV1(umi, {
    authority,
  }).sendAndConfirm(umi);

  const profilePda = findExecutiveProfileV1Pda(umi, { authority });

  return {
    authority: authority.toString(),
    profilePda: profilePda.toString(),
  };
}

export async function delegateAgentExecution(
  agentAssetPublicKey: string,
  executiveAuthorityPublicKey: string,
  config?: UmiConfig,
): Promise<DelegationInfo> {
  const umi = createUmiInstance(config);
  const agentAsset = publicKey(agentAssetPublicKey);
  const executiveAuthority = publicKey(executiveAuthorityPublicKey);
  const agentIdentity = findAgentIdentityV1Pda(umi, { asset: agentAsset });
  const executiveProfile = findExecutiveProfileV1Pda(umi, {
    authority: executiveAuthority,
  });

  await delegateExecutionV1(umi, {
    agentAsset,
    agentIdentity,
    executiveProfile,
  }).sendAndConfirm(umi);

  const delegateRecord = findExecutionDelegateRecordV1Pda(umi, {
    executiveProfile,
    agentAsset,
  });

  return {
    agentAsset: agentAssetPublicKey,
    executiveAuthority: executiveAuthorityPublicKey,
    delegateRecordPda: delegateRecord.toString(),
    exists: true,
  };
}

// ---------------------------------------------------------------------------
// Agent Discovery & Verification
// ---------------------------------------------------------------------------

export async function findAgentsByOwner(
  walletAddress: string,
  config?: UmiConfig,
): Promise<RegisteredAgentInfo[]> {
  const umi = createUmiInstance(config);
  const rpcUrl = config?.rpcUrl ?? DEFAULT_RPC;

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAssetsByOwner",
      params: [
        walletAddress,
        {
          sortBy: { sortBy: "created", sortDirection: "desc" },
          page: 1,
          limit: 100,
        },
      ],
    }),
  });

  if (!res.ok) return [];
  const json = await res.json();
  const assets = json?.result?.items ?? [];

  const agents: RegisteredAgentInfo[] = [];
  for (const asset of assets) {
    const id = asset.id;
    if (!id) continue;
    const identityPda = findAgentIdentityV1Pda(umi, { asset: publicKey(id) });
    const accountInfo = await umi.rpc.getAccount(identityPda).catch(() => null);
    if (!accountInfo?.exists) continue;
    agents.push({
      asset: id,
      collection: asset.grouping?.[0]?.group_value ?? "",
      name: asset.content?.metadata?.name ?? "",
      uri: asset.content?.metadata?.uri ?? "",
      identityPda: identityPda.toString(),
    });
  }
  return agents;
}

export async function verifyAgentIdentity(
  agentAssetPublicKey: string,
  config?: UmiConfig,
): Promise<{ verified: boolean; identityPda?: string }> {
  try {
    const umi = createUmiInstance(config);
    const asset = publicKey(agentAssetPublicKey);
    const identityPda = findAgentIdentityV1Pda(umi, { asset });
    const account = await umi.rpc.getAccount(identityPda);
    return { verified: account.exists, identityPda: identityPda.toString() };
  } catch {
    return { verified: false };
  }
}

export async function checkExecutionDelegation(
  agentAssetPublicKey: string,
  executiveAuthorityPublicKey: string,
  config?: UmiConfig,
): Promise<{ delegated: boolean; delegateRecordPda?: string }> {
  try {
    const umi = createUmiInstance(config);
    const executiveProfile = findExecutiveProfileV1Pda(umi, {
      authority: publicKey(executiveAuthorityPublicKey),
    });
    const delegateRecord = findExecutionDelegateRecordV1Pda(umi, {
      executiveProfile,
      agentAsset: publicKey(agentAssetPublicKey),
    });
    const account = await umi.rpc.getAccount(delegateRecord);
    return {
      delegated: account.exists,
      delegateRecordPda: delegateRecord.toString(),
    };
  } catch {
    return { delegated: false };
  }
}

export function buildAgentMetadata(input: {
  name: string;
  description?: string;
  image?: string;
  services?: AgentService[];
  x402Support?: boolean;
  supportedTrust?: string[];
  crossRegistryRegistrations?: CrossRegistryRegistration[];
}): AgentMetadataDocument {
  return {
    type: EIP_8004_TYPE,
    name: input.name,
    description: input.description ?? "",
    image: input.image,
    services: input.services,
    x402Support: input.x402Support ?? false,
    active: true,
    registrations: input.crossRegistryRegistrations,
    supportedTrust: input.supportedTrust ?? ["reputation"],
  };
}

export async function fetchAgentMetadata(
  agentUri: string,
): Promise<AgentMetadataDocument | null> {
  try {
    const res = await fetch(agentUri);
    if (!res.ok) return null;
    return (await res.json()) as AgentMetadataDocument;
  } catch {
    return null;
  }
}

// Re-export PDA derivation
export {
  findAgentIdentityV1Pda,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
};