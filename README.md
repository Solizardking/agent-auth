# Agent Auth

Open-source implementations of the **[Agent Auth Protocol](https://agent-auth-protocol.com)** — authentication, capability-based authorization, and service discovery for AI agents. Built Solana-first with **CAAP/1.0** (Clawd Agent Attestation Protocol): SIWS sign-in, Helius DAS verification, CLAWD token balance checking, and subscription tier gating.

Agents discover your service, register with a cryptographic identity, request capabilities, and execute them. Sensitive actions stay behind user approval. Solana wallets are first-class identities.

---

## Solana Extension — `@clawd/agent-auth-solana`

[`packages/agent-auth-solana/`](packages/agent-auth-solana/) is the core Solana layer. It implements CAAP/1.0 on top of Agent Auth:

- **SIWS** — Sign In With Solana (EIP-4361-style)
- **DAS Verification** — Helius DAS API checks for agent NFTs in the wallet
- **Token Attestation** — CLAWD SPL token balance via `getTokenAccountsByOwner`
- **Subscription Tiers** — Balance maps to Free / Bronze / Silver / Gold / Diamond

### Install

```bash
npm install @clawd/agent-auth-solana
# peer deps:
npm install better-auth better-auth-solana
```

### Server setup

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
    }),
  ],
});
```

Registers three CAAP endpoints automatically:

- `POST /caap/attest` — full attestation + snapshot + tier
- `GET /caap/status/:agentId?wallet=` — lightweight verified/unverified check
- `GET /caap/discovery` — CAAP/1.0 protocol discovery document

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

### Attestation & tiers

```ts
import { attestAgent, fetchWalletSnapshot, computeTier } from "@clawd/agent-auth-solana";

const opts = {
  heliusRpcUrl: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  clawdMint: "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
};

const attestation = await attestAgent(agentId, walletAddress, opts);
const snapshot = await fetchWalletSnapshot(walletAddress, opts);
const tier = computeTier(snapshot.clawdBalance);
// tier.tier, tier.nextTier, tier.percentToNext, tier.clawdToNextTier
```

### CAAP/1.0 Verification Phases

1. **SIWS** — Sign In With Solana establishes wallet-backed identity
2. **DAS Verification** — Helius `getAssetsByOwner` finds agent NFTs (names containing "agent" or "clawd")
3. **Token Attestation** — CLAWD SPL balance check proves stake
4. **Subscription Tier** — Balance maps to access level

### Subscription Tiers

| Tier    | CLAWD Required |
| ------- | -------------- |
| Free    | 0              |
| Bronze  | 100,000        |
| Silver  | 500,000        |
| Gold    | 1,000,000      |
| Diamond | 5,000,000      |

**Default CLAWD mint:** `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`

Live demo: [x402.wtf/agentauth](https://x402.wtf/agentauth)

---

## Packages

| Package | Description | Install |
| ------- | ----------- | ------- |
| [`@clawd/agent-auth-solana`](packages/agent-auth-solana/) | Solana CAAP/SIWS extension | `npm i @clawd/agent-auth-solana` |
| [`@better-auth/agent-auth`](packages/agent-auth/) | Better Auth server plugin | `npm i @better-auth/agent-auth` |
| [`@auth/agent`](packages/sdk/) | Client SDK for agent runtimes | `npm i @auth/agent` |
| [`@auth/agent-cli`](packages/cli/) | CLI and MCP server | `npx @auth/agent-cli` |

---

## Client SDK — `@auth/agent`

```bash
npm install @auth/agent
```

```ts
import { AgentAuthClient } from "@auth/agent";

const client = new AgentAuthClient({
  directoryUrl: "https://directory.example.com",
});

// Discover a provider
const config = await client.discoverProvider("https://api.example.com");

// Connect with constrained capabilities
const agent = await client.connectAgent({
  provider: "https://api.example.com",
  capabilities: [
    "read_data",
    { name: "transfer_money", constraints: { amount: { max: 1000 } } },
  ],
  name: "my-assistant",
});

// Execute
const result = await client.executeCapability({
  agentId: agent.agentId,
  capability: "read_data",
  arguments: { id: "user-123" },
});
```

### AI Framework Adapters

**Vercel AI SDK**

```ts
import { generateText } from "ai";
import { AgentAuthClient, getAgentAuthTools, toAISDKTools } from "@auth/agent";

const client = new AgentAuthClient();
const tools = await toAISDKTools(getAgentAuthTools(client));

const { text } = await generateText({ model: openai("gpt-4o"), tools, prompt: "Transfer $50 to Alice" });
```

**Anthropic Claude**

```ts
import { AgentAuthClient, getAgentAuthTools, toAnthropicTools } from "@auth/agent";

const client = new AgentAuthClient();
const { definitions, processToolUse } = toAnthropicTools(getAgentAuthTools(client));

const res = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools: definitions,
  messages,
});

const toolUseBlocks = res.content.filter((b) => b.type === "tool_use");
if (toolUseBlocks.length > 0) {
  const results = await processToolUse(toolUseBlocks);
  messages.push({ role: "assistant", content: res.content }, { role: "user", content: results });
}
```

**OpenAI Function Calling**

```ts
import { AgentAuthClient, getAgentAuthTools, toOpenAITools } from "@auth/agent";

const client = new AgentAuthClient();
const { definitions, execute } = toOpenAITools(getAgentAuthTools(client), { strict: true });

const res = await openai.chat.completions.create({ model: "gpt-4o", tools: definitions, messages });
for (const call of res.choices[0].message.tool_calls ?? []) {
  const result = await execute(call.function.name, JSON.parse(call.function.arguments));
}
```

### SDK Tools

| Tool | Description |
| ---- | ----------- |
| `list_providers` | List discovered/configured providers |
| `search_providers` | Search registry by intent |
| `discover_provider` | Look up a provider by URL |
| `list_capabilities` | List provider capabilities |
| `describe_capability` | Get full capability definition |
| `connect_agent` | Register an agent (with optional constraints) |
| `execute_capability` | Execute a granted capability |
| `request_capability` | Request additional capabilities |
| `agent_status` | Check agent status and grants |
| `sign_jwt` | Sign an agent JWT manually |
| `disconnect_agent` | Revoke an agent |
| `reactivate_agent` | Reactivate an expired agent |
| `rotate_agent_key` | Rotate agent keypair |
| `rotate_host_key` | Rotate host keypair |
| `enroll_host` | Enroll host with enrollment token |

### Filtering tools

```ts
import { getAgentAuthTools, filterTools } from "@auth/agent";

const minimal = filterTools(getAgentAuthTools(client), { only: ["execute_capability", "agent_status"] });
const safe    = filterTools(getAgentAuthTools(client), { exclude: ["sign_jwt", "rotate_host_key"] });
```

---

## CLI — `@auth/agent-cli`

```bash
npx @auth/agent-cli --help
```

### Quick workflow

```bash
# 1. Discover a provider
auth-agent discover https://api.example.com

# 2. Search by intent
auth-agent search "deploy web apps"

# 3. List capabilities
auth-agent capabilities --provider https://api.example.com

# 4. Describe a capability before executing
auth-agent describe transfer_money --provider https://api.example.com

# 5. Connect an agent
auth-agent connect --provider https://api.example.com \
  --capabilities read_data transfer_money \
  --constraints '{"transfer_money":{"amount":{"max":1000}}}' \
  --name my-agent

# 6. Check status (confirm active + granted)
auth-agent status <agent-id>

# 7. Execute a capability
auth-agent execute <agent-id> transfer_money --args '{"amount": 50, "to": "alice"}'

# 8. Request additional capabilities
auth-agent request <agent-id> --capabilities admin_panel --reason "Need deployment access"

# 9. Key rotation
auth-agent rotate-agent-key <agent-id>

# 10. Disconnect
auth-agent disconnect <agent-id>
```

### All Commands

| Command | Description |
| ------- | ----------- |
| `discover <url>` | Discover a provider |
| `search <intent>` | Search directory for providers |
| `providers` | List known providers |
| `capabilities` | List capabilities for a provider |
| `describe <name>` | Get full capability definition |
| `connect` | Connect an agent to a provider |
| `status <agent-id>` | Check agent status |
| `execute <agent-id> <capability>` | Execute a capability |
| `request <agent-id>` | Request additional capabilities |
| `sign <agent-id>` | Sign an agent JWT |
| `disconnect <agent-id>` | Disconnect an agent |
| `reactivate <agent-id>` | Reactivate expired agent |
| `connections <issuer>` | List agent connections |
| `connection <agent-id>` | Get a stored connection |
| `rotate-agent-key <agent-id>` | Rotate agent keypair |
| `rotate-host-key <issuer>` | Rotate host keypair |
| `enroll-host` | Enroll host with token |
| `mcp` | Start MCP server |

### Environment Variables

| Variable | Description |
| -------- | ----------- |
| `AGENT_AUTH_STORAGE_DIR` | Storage directory for keys and connections (default: `~/.agent-auth`) |
| `AGENT_AUTH_DIRECTORY_URL` | Directory URL for provider search |
| `AGENT_AUTH_HOST_NAME` | Host name for identification |
| `AGENT_AUTH_ENCRYPTION_KEY` | Encrypts private keys at rest |

---

## MCP Server

Run as an MCP server for AI agent integration (Cursor, Claude Code, Claude Desktop):

```bash
auth-agent mcp --url https://api.example.com
```

### Configuration

```json
{
  "mcpServers": {
    "auth-agent": {
      "command": "npx",
      "args": ["@auth/agent-cli", "mcp", "--url", "https://api.example.com"]
    }
  }
}
```

The MCP server exposes the same 17 tools as the SDK. Standard workflow:

```
1. list_providers          → see what's already configured
2. search_providers        → find a provider by intent
3. list_capabilities       → see what the provider offers
4. describe_capability     → understand input schema before executing
5. connect_agent           → authenticate and get an agent_id
6. agent_status            → confirm active + granted
7. execute_capability      → run with correct arguments
```

---

## Examples

Next.js reference apps under [`examples/`](examples/) integrate `@better-auth/agent-auth` with Drizzle:

| Example | Description |
| ------- | ----------- |
| [`agent-coffee`](examples/agent-coffee/) | SIWS + CAAP attestation + subscription tiers |
| [`agent-deploy`](examples/agent-deploy/) | Baseline flow with email/password sign-in |
| [`brex-agent`](examples/brex-agent/) | Brex payment approval with agent grants |
| [`stripe-agents`](examples/stripe-agents/) | Stripe payment flows with agent authorization |
| [`gmail-proxy`](examples/gmail-proxy/) | WebAuthn/passkeys enabled proxy |
| [`vercel-proxy`](examples/vercel-proxy/) | Same stack, Vercel OAuth proxy |

The [`apps/`](apps/) directory contains internal applications (provider directory, desktop, browser extension) used in development and demos.

---

## CI and Releases

GitHub Actions (under [`.github/workflows/`](.github/workflows/)):

- **CI** — On pull requests and pushes to `main` / `canary`: **`pnpm fmt:check`** ([Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)), then install with a frozen lockfile and `turbo` **build**, **typecheck**, and **test** for [`packages/*`](packages/) on Node **22.x** and **24.x**. Format locally with **`pnpm fmt`**.
- **Release** — Pushing a tag `v*` runs [changelogithub](https://github.com/antfu/changelogithub), builds packages, and publishes to npm via `pnpm -r publish`. **Required:** repository secret `NPM_TOKEN`. Tags matching `*-beta`, `*-rc`, `*-canary`, or `*-next` publish under that dist-tag.
- **Preview** — Pull requests trigger [pkg-pr-new](https://github.com/stackblitz-labs/pkg.pr.new) for installable PR previews of `./packages/*`.
- **npm dist-tag** — Manual workflow to move a dist-tag on an existing version.

Optional: set `TURBO_TOKEN` and `TURBO_TEAM` for [Vercel Remote Cache](https://turbo.build/repo/docs/core-concepts/remote-caching).

---

## License

[MIT](LICENSE) — Clawd Labs, 2026
