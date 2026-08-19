# Sprint Architecture Bridge

## Overview

`privacy_msg` sprint integrates E2EE messaging with STRK20 private transfers.
This document maps which components come from the audited audit repository versus what
was newly (and incorrectly) invented during Sprint Phase 1.

Last updated: 2026-08-19  
Forensic recovery baseline: `c512b7c`

---

## Architecture Column Definitions

| Column | Meaning |
|--------|---------|
| **AUDIT: VERIFIED** | Audited in `/home/wner/audits/starknet-privacy`, security-critique passed |
| **AUDIT: PROVISIONAL** | In audit repo but not yet independently verified/closed |
| **AUDIT: PENDING** | In audit repo, known open issues before migration |
| **AUDIT: NOT PRESENT** | Does not exist in audit repo |
| **PUBLIC: PRESENT** | Exists in this repository with matching semantics |
| **PUBLIC: NOT PRESENT** | Does not exist in this repository |
| **PUBLIC: REJECTED** | Existed but failed forensic review (do not use) |

---

## Component Status

| Component | Audit Repo | Public Repo | Status |
|-----------|-----------|-------------|--------|
| **Commit03 identity/session** | AUDIT: PROVISIONAL — session_seed establishment, authenticated identity bundle, 32-byte address fix | PUBLIC: NOT PRESENT | Migration blocked — Commit03 not closed |
| **Commit04 E2EE vector spec** | AUDIT: PROVISIONAL — directional symmetric chains, per-message AES-256-GCM key, secure deletion spec | PUBLIC: NOT PRESENT | Migration blocked — Commit04 not closed |
| **Commit04 golden test vectors** | AUDIT: PENDING — golden vectors for session_context → chain → message key | PUBLIC: NOT PRESENT | Migration blocked |
| **E2EE cryptographic implementation (e2ee.ts)** | AUDIT: NOT PRESENT | PUBLIC: REJECTED — E2EE-F2 CRITICAL PKCS8 bug, E2EE-F4 roundtrip FAIL, E2EE-F5 u256 FAIL | **Do not use.** Migrate from Commit04 when closed. |
| **Forward secrecy claim** | AUDIT: NOT APPROVED — Commit04 model is session chain, not per-message ephemeral | PUBLIC: REJECTED | **Claim removed.** |
| **note-discovery.ts** | AUDIT: NOT PRESENT | PUBLIC: REJECTED — assumes plaintext `get_channel_info` return; upstream returns `EncChannelInfo` (all fields encrypted). | **Do not use.** |
| **PrivacyMsgMailbox (Commit03 transport)** | AUDIT: NOT PRESENT in audit — architectural design in audit repo docs | PUBLIC: NOT PRESENT | Architectural decision pending |
| **STRK20 Wallet API v6** | AUDIT: N/A (upstream) | PUBLIC: PRESENT — starter kit `strk20InvokeTransaction` | Usable for private value transfer |
| **STRK20 pool-as-message-mailbox** | AUDIT: NOT APPROVED | PUBLIC: REJECTED — pool `transfer()` has no calldata persistence for arbitrary payload; `InvokeExternal` action requires external contract | **Do not build around imaginary calldata persistence.** |
| **privacy_invoke / anonymizer helper** | AUDIT: NOT APPROVED | PUBLIC: NOT PRESENT | STOP — do not build until pool calldata persistence is proven |
| **Send path (handleSend)** | AUDIT: NOT PRESENT | PUBLIC: REJECTED — wired to imaginary pool transfer calldata; ad-hoc E2EE bugs | **Disabled.** |
| **E2EE → calldata encoding** | AUDIT: NOT PRESENT | PUBLIC: REJECTED — envelopeToCalldata has u256 big-endian bugs; ad-hoc protocol | **Disabled.** |
| **Registration flow** | AUDIT: NOT PRESENT | PUBLIC: PRESENT — `/messages` page scaffold | UI shell only |
| **Test infrastructure** | AUDIT: N/A | PUBLIC: NOT PRESENT — `package.json` had fake `test: "node --version"` | **Removed.** Real tests required before Phase 2. |
| **SDK file: dependency** | AUDIT: N/A | PUBLIC: FIXED — `file:../../../tmp/...` removed; zero SDK imports | Resolved |

---

## Corrected Historical Claims

| Incorrect Claim | Correction |
|----------------|------------|
| "20-byte address → 32-byte bug fix" | Actual fix: 31-byte → 32-byte canonical Starknet address encoding (Commit03) |
| "pool.transfer calldata encodes arbitrary encrypted message" | Pool `transfer(recipient, amount, data)` — `data` is pool-internal note encoding; no arbitrary calldata persistence confirmed |
| "STRK20 invoke persists calldata for message retrieval" | No such persistence exists without helper contract + `InvokeExternal` |

---

## Phase 2 Prerequisites (Sprint Gate)

Before Sprint Phase 2:

- [ ] **Commit03 closure** — session_seed / identity bundle audit must close
- [ ] **Commit04 closure** — directional chain + golden vectors must pass independent verification
- [ ] **Real test infrastructure** — `npm test` runs meaningful application tests
- [ ] **Correct E2EE implementation** — either migrate Commit04 or use audited SDK route
- [ ] **Pool discovery route confirmed** — upstream must document how wallet dapps retrieve messages
- [ ] **STRK20 integration route confirmed** — exact Wallet API action for private value transfer
- [ ] **Alchemy + GitHub PAT rotation** — MANUAL: user must revoke and regenerate
- [ ] **`NEXT_PUBLIC_PROVIDER_URL` credential model** — rename to `RPC_API_KEY` (Model B server-side secret); `NEXT_PUBLIC_` prefix is incorrect

---

## STRK20 Integration Routes (Research Only — No Implementation)

### Route A: E2EE message + independent private STRK20 value transfer
- STRK20 hides **value** and **relationship** (who sent how much to whom)
- E2EE hides **content** (message body)  
- **Public metadata**: pool transactions visible on-chain with encrypted note data
- **Recipient semantics**: pool sees encrypted note; only recipient can decrypt with session key
- **Failure semantics**: if E2EE decrypt fails, message is lost; STRK20 transfer may still succeed
- **Atomicity**: NONE — two separate operations
- **Verdict**: viable for content + value privacy separately

### Route B: E2EE message identifier bound to private transfer
- E2EE envelope includes a **note commitment** from a prior STRK20 deposit
- Recipient must first receive a private deposit to become aware of the channel
- **Public metadata**: one STRK20 deposit transaction visible; subsequent messages reference note hash
- **Verdict**: viable but requires deposit-first channel establishment

### Route C: privacy_invoke helper (application contract execution)
- Requires **helper contract** deployed by the app
- App contract executes within STRK20 privacy context
- `InvokeExternal` persists calldata; app contract can store/forward message
- **Verdict**: requires app contract development and audit; not a short-term option
