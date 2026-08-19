# P0 Sprint Forensic Recovery Report

**Date:** 2026-08-19 15:49 IDT
**Baseline:** `c512b7c` (pre-recovery start)
**Recovery commit:** `eb00bd3`
**Status:** RECOVERED

---

## PUBLIC REPO

| Item | Before | After |
|------|--------|-------|
| Starting bad commit | `c512b7c` | — |
| Corrective commits | `eb00bd3` | — |
| Build | Passes (clean) | — |
| Real tests | `npm test` → 3 PASS (vitest) | — |

### Test Infrastructure

```
npm test → vitest run
  ✓ POOL_ADDRESS is a valid Starknet hex address
  ✓ POOL_ADDRESS is not zero or empty
  ✓ POOL_ADDRESS is a正经felt252 (non-zero)
Test Files  1 passed (1)
     Tests  3 passed (3)
```

### Removed/Rejected

- `test: "node --version"` fake test — DELETED
- `note-discovery.ts` — DISABLED (pool returns `EncChannelInfo` all encrypted; assumed plaintext)
- ad-hoc E2EE claims — DISABLED in shipping path (PKCS8 slice bug + roundtrip failures)
- fake privacy claims in UI — CORRECTED to "integration pending"

---

## SECRETS

| Credential | Status |
|-----------|--------|
| Alchemy old revoked | **NO / MANUAL_REQUIRED** |
| GitHub PAT old revoked | **NO / MANUAL_REQUIRED** |
| `NEXT_PUBLIC_PROVIDER_URL` credential model | **Model B** — server-side secret API key; `NEXT_PUBLIC_` prefix is incorrect usage |

`NEXT_PUBLIC_PROVIDER_URL` is appended to `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/` at runtime. It is never sent to the browser, but the `NEXT_PUBLIC_` namespace implies it is. Correct fix: rename to `RPC_API_KEY` (server-side only).

---

## EDPH

| Item | Value |
|------|-------|
| Authoritative frozen commit | `eb6023c` (feat/v1.1-production-hardening) |
| Frozen artifact | `edph-v1-20260818.tar` SHA256=`3fd705f...` |
| In-evaluation harness modifications | **ZERO** — frozen harness used for all evaluation |
| Inventory | PASS |
| Sanitize | PASS |
| Verify | **NOT YET RUN** — await independent harness freeze before next EDPH run |

**Harness triage (06f2637 vs frozen baseline):**

| Modification | Classification | Risk |
|-------------|---------------|------|
| `npm ci` → `npm ci --ignore-scripts --no-audit` | FALSE_POSITIVE_FIX | Low |
| `npm run build` → `node next/dist/bin/next build` | EXECUTION_COMPATIBILITY | Medium |
| PATH order: linuxbrew npm v11, Node v22 prepended | EXECUTION_COMPATIBILITY | Medium |
| RLIMIT_CPU 60→180s | BUG_FIX | Low |
| RLIMIT_NPROC (256) **removed** | SECURITY_WEAKENING | High — fork bomb protection gone |
| RLIMIT_FSIZE (50MB) → **100MB** | SECURITY_WEAKENING | Medium — artifact size cap reduced |
| `npm_config_user_agent` re-injection | BUG_FIX | Low |
| Tool extractor while-loop | BUG_FIX | Low |
| Module-level shutil import | BUG_FIX | Low |
| `home_path` anchored `(?m)^` | FALSE_POSITIVE_FIX | Low |
| `local_hostname` narrowed (localhost variants only) | FALSE_POSITIVE_FIX | Medium |

**Note:** V9_build NPROC removal was found to be necessary because Node.js v22.23.2 + Next.js 16.3.1 with NPROC=64 causes SIGABRT in `WorkerThreadsTaskRunner`. The removal is documented as a known trade-off. FSIZE increased to 100MB because Next.js `.next` cache artifacts exceed 50MB.

---

## REJECTED IMPLEMENTATION

### e2ee.ts — DISABLED (not deleted)

**E2EE-F2 CRITICAL:** `ephemeralPrivkey.slice(-32)` on PKCS8 DER encodes the wrong bytes.
The P-256 scalar is not at the end of the PKCS8 structure. ECDH shared secret derivation produces garbage.

**E2EE-F4 FAIL:** `bytesToFelts` → `feltsToBytes` roundtrip broken for non-31-byte-multiple inputs.
- 1 byte → recovers 31 bytes (pads to felt boundary)
- 30 bytes → recovers 31 bytes (zero-pads first felt)
- 32 bytes → recovers 62 bytes (each felt separately padded)
- Only exact multiples of 31 pass

**E2EE-F5 FAIL:** u256 big-endian split of P-256 x coordinate loses trailing-zero bytes.

### Forward Secrecy Claim — REMOVED

`e2ee.ts` header claimed "Each message uses a fresh ephemeral keypair — forward secrecy."
Commit04 model is session_chain → directional symmetric chains → per-message key. Not approved as forward secrecy. Claim removed.

### note-discovery.ts — DISABLED

**MISMATCH CONFIRMED:**
- note-discovery.ts assumes `get_channel_info` returns `[sender_felt, ...note_id_felts]` — plaintext
- SDK `EncChannelInfo` = `{ ephemeral_pubkey, enc_channel_key, enc_sender_addr }` — all fields **encrypted**

Cannot recover sender or note IDs without decryption using the channel key.

### pool-as-message-mailbox — REJECTED

Pool `transfer(recipient, amount, data)` — `data` is pool-internal note encoding with no arbitrary calldata persistence. `InvokeExternal` requires external contract execution. No calldata persistence confirmed for arbitrary payload.

---

## AUDITED ARCHITECTURE

### Commit03 Identity/Session — PROVISIONAL

- `/home/wner/audits/starknet-privacy/sdk/src/privacy-msg-v2/session-ratchet.ts`
- `/home/wner/audits/starknet-privacy/sdk/tests/identity-handshake.test.ts`
- Security status: Gate C verified
- Migration status: **NOT MIGRATED** — pending audit closure

### Commit04 E2EE Vector Spec — PROVISIONAL/PENDING

- `/home/wner/audits/starknet-privacy/sdk/commit04-vectors.mjs`
- `/home/wner/audits/starknet-privacy/sdk/commit04-vectors.json`
- Golden vectors exist but not independently verified in this cycle
- V2_MIGRATION_SPEC.md: V1 `encryptMessage` DELETED (catastrophic failures confirmed)
- Migration status: **NOT MIGRATED** — pending Commit04 independent verification closure

### PrivacyMsgMailbox

- Commit03 transport design in audit repo docs
- Sepolia deployment: `deploy-mailbox-v2-sepolia.mjs`
- Migration status: **NOT MIGRATED** — architectural decision pending STRK20 integration route

---

## STRK20 WALLET API

**Source:** SDK `@starkware-libs/starknet-privacy-sdk@0.14.3-rc.5` (`pool-contract-interface.d.ts`)

### Valid Action Types

`STRK20_INVOKE` accepts 10 action types via `strk20InvokeTransaction`:

| Action | Input | Use |
|--------|-------|-----|
| `SetViewingKey` | `{ random }` | Register viewing key |
| `OpenChannel` | `{ recipient_addr, index, random, salt }` | Open encrypted channel |
| `OpenSubchannel` | `{ recipient_addr, recipient_public_key, channel_key, index, token, salt }` | Open subchannel |
| `CreateEncNote` | `{ recipient_addr, recipient_public_key, token, amount, index, salt }` | Create encrypted note |
| `CreateOpenNote` | `{ recipient_addr, recipient_public_key, token, index, random }` | Create open note |
| `Deposit` | `{ token, amount }` | Deposit to pool |
| `UseNote` | `{ channel_key, token, index }` | Spend note |
| `Withdraw` | `{ to_addr, token, amount, random }` | Withdraw from pool |
| `InvokeExternal` | `{ contract_address, calldata }` | Invoke external contract |
| `ComputeAndInvoke` | `{ contract_address, compute_additional_data, invoke_additional_data }` | Compute + invoke |

**pool-as-message-mailbox:** NOT SUPPORTED. No action type persists arbitrary calldata in the pool. `InvokeExternal` requires an external contract address and cannot be used to store data in the pool itself.

### Candidate Integration Route

**Route A: E2EE message + independent private STRK20 value transfer**

| Property | STRK20 | E2EE |
|----------|--------|------|
| Value privacy | ✓ Hides amount + relationship | — |
| Content privacy | — | ✓ Hides message body |
| Public metadata | Pool transactions visible (encrypted note data) | — |
| Recipient semantics | Pool sees encrypted note; only recipient decrypts | — |
| Failure semantics | Independent — transfer and message are separate | — |
| Atomicity | NONE — two separate operations | — |

Viable for content + value privacy independently.

---

## VERDICT

**RECOVERED**

The public repository is now in an evidence-clean state with:
- Correct UI claims ("integration pending")
- No fake tests
- Real test infrastructure (vitest, 3 passing tests)
- Corrected architecture bridge doc
- Ad-hoc E2EE disabled in shipping path
- Invalid note discovery disabled
- No unverified privacy claims

**Sprint Phase 2 is NOT authorized.** Prerequisites remain:
1. Commit03 closure — session_seed / identity bundle audit must close
2. Commit04 closure — directional chain + golden vectors must pass independent verification
3. Real application tests (beyond constants)
4. Alchemy + GitHub PAT rotation (MANUAL — user must act)
5. EDPH re-run after independent harness freeze

**No new feature development. No mainnet transactions. No privacy claims without audit closure.**
