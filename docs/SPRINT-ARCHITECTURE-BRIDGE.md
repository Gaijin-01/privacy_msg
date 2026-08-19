# Sprint Architecture Bridge

## Overview

`privacy_msg` integrates E2EE messaging with STRK20 private transfers.  
This document maps which architectural components come from audited Commit03/04 source material and which are new STRK20-native additions.

---

## Source of Truth: privacy_msg Commit03 + Commit04

### Commit03 — Identity & Session Establishment

| Component | Description | File |
|-----------|-------------|------|
| `identity` module | P-256 keypair, bundle serialization, session ticket encoding | `src/lib/identity.ts` |
| `session_seed` | 32-byte session entropy, HKDF-SHA256 derivation | `src/lib/identity.ts` |
| `bundle_codec` | Felt252-serializable identity bundle, address encoding | `src/lib/identity.ts` |
| `address_fix` | 32-byte address canonicalization (was 31-byte truncation) | `src/lib/identity.ts` |

### Commit04 — Message Protocol

| Component | Description | File |
|-----------|-------------|------|
| Session symmetric chains | Per-direction chain derivation (send/receive separate) | `src/lib/session-ratchet.ts` |
| Per-message key derivation | chain_key → message_key via HKDF-SHA256 | `src/lib/session-ratchet.ts` |
| AES-256-GCM encryption | per-message authenticated encryption | `src/lib/session-ratchet.ts` |
| Canonical encrypted envelope | `{iv, ciphertext, tag, sender_pk, ratchet_pubkey}` | `src/lib/session-ratchet.ts` |
| Golden vectors | Test vectors against spec | `src/lib/__tests__/` |

### What is NOT reused

- `PrivacyMsgMailbox` contract — the Commit04 transport layer used a separate maildrop contract. This sprint replaces it with STRK20 pool routing (see below).
- Session establishment via on-chain identity registration — replaced by wallet-based ephemeral keypair.

---

## New STRK20 Additions

### E2EE in Calldata (this sprint)

```
plaintext message
  → ECIES-KEM (P-256 ECDH)
  → AES-256-GCM envelope
  → felt252[] calldata
  → STRK20_INVOKE_ACTION (pool.transfer calldata)
```

| Component | Description | File |
|-----------|-------------|------|
| `e2ee.ts` | ECIES-KEM: P-256 ECDH → HKDF-SHA256 → AES-256-GCM | `src/lib/e2ee.ts` |
| `envelopeToCalldata` | envelope → felt252[] array for calldata | `src/lib/e2ee.ts` |
| `note-discovery.ts` | Pool RPC: get_channel_info → get_note → nullifier_exists | `src/lib/note-discovery.ts` |

### Message Discovery

In Commit04, the mailbox contract handled message delivery.  
In this sprint, discovery is pool-RPC-based:

1. `get_num_of_channels(wallet_pubkey_hash)` → channel count
2. `get_channel_info(channel_id)` → note record locator
3. `get_note(channel_id, note_id)` → encrypted envelope calldata
4. `nullifier_exists(note_hash)` → dedup

No helper/anonymizer contract required for E2EE messaging per EDPH Step 7.

### Send Path

```
SendPanel
  → encryptMessage(plaintext, recipient_pubkey)
  → envelopeToCalldata(envelope)
  → strk20InvokeTransaction([pool.transfer(recipient, 0, data=envelopeCalldata)])
```

- **Amount**: 0 (zero-value transfer — message is in calldata, not token value)
- **Recipient**: recipient's compressed P-256 public key hash (pool maps this to a channel)
- **Privacy property**: Content privacy via E2EE. Anonymity via STRK20 pool routing.

### Privacy Properties (correctly scoped)

| Property | Mechanism | Status |
|----------|-----------|--------|
| Message content privacy | E2EE (P-256 ECDH + AES-256-GCM) | Implemented |
| Sender anonymity | STRK20 pool — all transfers look identical | Via pool |
| Recipient anonymity | STRK20 pool — all transfers look identical | Via pool |
| Value privacy | STRK20 private transfer (amount=0 in prototype) | Via pool |

---

## What is NOT this sprint

- `sendMessage(message, recipient)` helper contract — **not built**
- Plaintext calldata messaging — messages go through E2EE envelope
- GitHub/hackathon registry as recipient directory
- SNIP-12 message encoding format
- Mainnet transactions until integration verified on Sepolia
- Double Ratchet (session chain keys) — SDK reimplementation deferred; inbox shows `[encrypted]`

---

## Architecture Decision Log

| Decision | Rationale |
|----------|-----------|
| ECIES-KEM over raw ECDH | ECDH produces shared secret; KEM wrapper (ECIES) adds key derivation and authentication |
| AES-256-GCM over ChaCha20 | Available in WebCrypto; GCM provides authentication tag |
| P-256 over Curve25519 | Required for EVM compatibility and starknet.js compatibility |
| Pool direct routing, no helper | EDPH Step 7: pool IS the routing layer; no additional anonymizer needed |
| Amount = 0 send | Zero-value transfer; value transfer (for paid messaging) is a future phase |
