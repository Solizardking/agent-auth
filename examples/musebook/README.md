# Musebook — Agent Auth provider

Musebook (https://musebook.trade) is a live **Agent Auth provider**: the
on-chain directory of Solana AI agents, with Solana-native agent
authentication — SIWS sign-in, Ed25519 agent registration, device-code
approval, and scoped capability execution. The server never signs wallet
transactions; signing always happens in the user's wallet or on the
user's device.

## Discovery

```bash
curl https://musebook.trade/.well-known/agent-configuration
```

Returns the provider configuration document (version `1.0-draft`,
issuer `https://musebook.trade/api/auth`, algorithms `[Ed25519]`,
modes `[delegated, autonomous]`, approval via `device_authorization`).
A verbatim snapshot is saved next to this file as
`agent-configuration.json`.

## Register an agent

Registration happens inside an authenticated session — sign in with
Solana first (SIWS), then register the agent's key:

```bash
# 1. Get a sign-in challenge
curl -X POST https://musebook.trade/api/siws/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet": "<your-solana-wallet-address>"}'
# → { nonce, message } — sign `message` with the wallet, then:
curl -X POST https://musebook.trade/api/siws/verify \
  -H "Content-Type: application/json" \
  -d '{"wallet": "<address>", "signature": "<base58-signature>"}'

# 2. Register the agent (authenticated session)
curl -X POST https://musebook.trade/api/auth/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-agent",
    "public_key": "<your-ed25519-public-key>",
    "mode": "delegated"
  }'
```

Agents can also be approved headlessly through the device-authorization
flow: the agent requests a device code at
`POST /api/auth/agent/device/code`, a human approves it in the browser
(https://agents.musebook.trade), and the agent polls for its grant.
See https://musebook.trade/agent-login for the walkthrough.

## Surface

| Area | Endpoints |
| --- | --- |
| Discovery | `GET /.well-known/agent-configuration` |
| SIWS | `POST /api/siws/challenge`, `POST /api/siws/verify` |
| Agent lifecycle | `POST /api/auth/agent/register`, `POST /api/auth/agent/device/code`, `GET /api/auth/agent/status`, `POST /api/auth/agent/introspect`, `POST /api/auth/agent/revoke`, `POST /api/auth/agent/rotate-key` |
| Capabilities | `GET /api/auth/capability/list`, `POST /api/auth/capability/execute` |
| API keys | `GET /api/keys/verify` |

## Listings

- Directory: https://agent-auth.directory/providers/musebook
- Registry: https://registry.musebook.trade/agent-auth
- x402 hub: https://musebook.trade/x402
- Payments catalog: `providers/clawd/agent-auth` in
  [solana-foundation/pay-skills](https://github.com/solana-foundation/pay-skills/pull/220)
