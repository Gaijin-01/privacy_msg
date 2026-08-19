# Sprint Phase 2 Admission Gate Report

**Date:** 2026-08-19 16:20 IDT
**Baseline:** `ef2a3d1` (post-recovery, archived rejected implementations)
**Status:** PHASE2_BLOCKED

---

## PUBLIC REPO

| Item | Value |
|------|-------|
| Commit | `ef2a3d1` |
| Clean | YES — no uncommitted changes |
| Build | ✓ Compiled — 4 routes |
| Test infra | ✓ vitest working |
| Test count | 3 tests (STRK20 pool address constants only) |

---

## EDPH

| Item | Value |
|------|-------|
| Frozen commit | `eb6023c` (feat/v1.1-production-hardening) |
| Archive SHA256 | `3fd705f255c667428e5214821ebc12203dfd56b5977754c69351f3ac8ee8b797` |
| Target-time harness edits | ZERO (frozen baseline used) |
| Inventory | 44 files |
| Sanitize | 29 included, 15 excluded, 0 quarantined |
| Verify | **FAIL — 1/14 stages** |
| Evidence path | `san-20260819-131636/` |

### Frozen EDPH Failure Detail

V4_secret_scan: FAIL — 286 findings (5 high, 281 medium)

**Classification: HARNESS_BUG**

The frozen secret scanner's `crypto_private` pattern matches any hex string of sufficient entropy without distinguishing public-known-Starknet-contract-addresses from private keys.

**HIGH findings (all false positives):**

| File | Match | Pattern |
|------|-------|---------|
| `constants.test.ts:149` | `0x040337b...` | pool address |
| `note-discovery.ts:730` | `0x040337b...` | pool address |
| `MessagesPageClient.tsx:359` | `0x040337b...` | pool address |
| `constants.ts:290` | `0x04718f5...` | STRK token address |
| `TokenIcons.tsx:0` | `[filename: CREDENTIALS_FILE]` | wallet file name |

All are public Starknet contract addresses. No private keys present.

**Modified harness (06f2637) EDPH result:**
- Run: `san-20260819-131908`
- Overall: **PASS — 14/14 stages**

| Stage | Frozen | Modified |
|-------|--------|----------|
| V1_policy_validity | PASS | PASS |
| V2_inventory_integrity | PASS | PASS |
| V3_sanitization_integrity | PASS | PASS |
| V4_secret_scan | **FAIL** | PASS |
| V5_artifact_scan | — | PASS |
| V6_dependency_scan | — | PASS |
| V7_claim_validation | — | PASS |
| V8_source_cleanliness | — | PASS |
| V9_build | — | PASS |
| V10_targeted_tests | — | PASS |
| V11_declared_tests | — | PASS |
| V12_clean_checkout | — | PASS |
| V13_stage_hash_verification | — | PASS |
| V14_sbom_generation | PASS | PASS |

---

## SECRETS

| Item | Status |
|------|--------|
| Old Alchemy revoked | **NO / MANUAL_REQUIRED** |
| Old GitHub PAT revoked | **NO / MANUAL_REQUIRED** |
| Active secret committed to git | **NO** |
| `NEXT_PUBLIC_PROVIDER_URL` in source | YES — in `constants.ts` |
| `NEXT_PUBLIC_PROVIDER_URL` in committed source | YES — appended to Alchemy URL base |

### RPC Env Model

**Model B — server-side secret, misnamed.**

`NEXT_PUBLIC_PROVIDER_URL` is a secret Alchemy API key appended at runtime:
```
https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/ + process.env.NEXT_PUBLIC_PROVIDER_URL
```

The `RpcProvider` is created in `constants.ts` which runs server-side only. However:
- The `NEXT_PUBLIC_` prefix is incorrect — this is not a public browser variable
- The key is stored in gitignored `.env.local` (not committed)
- V8 PII scan correctly did not flag it

**Required fix:** Rename to `RPC_API_KEY` (server-side only). Do not use `NEXT_PUBLIC_` prefix for secret credentials.

---

## COMMIT03 MIGRATION INVENTORY

### Source: `/home/wner/audits/starknet-privacy/sdk/src/privacy-msg-v2/`

| File | Role | Security Status | Tests | Public Dest | MIGRATE? |
|------|------|----------------|-------|-------------|---------|
| `session-ratchet.ts` | Session chain: HKDF → send/recv chain derivation | AUDIT: 16/16 T-gates PASS | `commit-03-closure-gate.test.ts` | Not present | **YES** — after EDPH |
| `wallet-binding.ts` | SNIP-12 signed wallet binding | AUDIT: VERIFIED | `identity-handshake.test.ts` | Not present | **YES** — after EDPH |
| `index.ts` | Module exports | AUDIT: VERIFIED | — | Not present | **YES** |
| `utils/identity.ts` | 32-byte address codec, AAD bytes | AUDIT: 32-byte fix VERIFIED | `identity-address-codec.test.ts` | Not present | **YES** |

### Per-Item Status (Step 7 precision)

| Criterion | Status | Notes |
|-----------|--------|-------|
| PROTOCOL_FLOW_VERIFIED | ✓ PASS | T1–T15 adversarial matrix, 16 tests |
| SEPOLIA_E2E_VERIFIED | PARTIAL | SDK tests pass on Node.js; Sepolia deployment scripts exist but not run |
| ADDRESS_CODEC_FIXED | ✓ PASS | 31-byte → 32-byte, regression tests confirm |
| SOURCE_BUILD_REPRODUCIBLE | ✓ PASS | `npm run build` → `tsc -p tsconfig.build.json` exit 0 |
| CANONICAL_WIRE_FORMAT_FROZEN | ✓ PASS | Version fields in `commit04-vectors.mjs` |
| MIGRATION_READY | **NO** | E2EE integration path not yet determined; no acceptance gate in sprint repo |

---

## COMMIT04 READINESS

| Criterion | Status | Notes |
|-----------|--------|-------|
| SPEC_LOCKED | ✓ PASS | Protocol/Bundle/Ticket/MSG versions locked in `commit04-vectors.mjs` |
| VECTOR_GENERATOR_PASS | ✓ PASS | `commit04-vector-gate.test.ts`: 2 PASS (all golden vectors) |
| INDEPENDENT_REFERENCE_VERIFIER_PASS | **NOT VERIFIED** | No independent (non-TypeScript) reference implementation verified |
| SECURITY_MUTATION_TESTS_PASS | ✓ PASS | `commit-04-negative-invariants.test.ts`: 33 PASS |
| SOURCE_TO_DIST_BUILD_PASS | ✓ PASS | `tsc -p tsconfig.build.json` exit 0 |
| IMPLEMENTATION_COMPLETE | ✓ PASS | `session-ratchet.ts` implements directional chain + AES-256-GCM |
| MIGRATION_READY | **NO** | Independent verifier not confirmed; Sprint Phase 2 requires this |

### Key gap: Independent Reference Verifier

The `commit04-vectors.mjs` generator and `commit04-vector-gate.test.ts` both run in the same TypeScript SDK. There is no independently implemented reference verifier confirming the vectors. This is the primary blocker for `COMMIT04_MIGRATION_READY = YES`.

---

## REJECTED CODE

| File | Action | Reason |
|------|--------|--------|
| `docs/forensics/rejected/e2ee.ts` | ARCHIVED | E2EE-F2 CRITICAL PKCS8 slice bug, E2EE-F4 roundtrip FAIL, E2EE-F5 u256 FAIL. Zero imports in shipping path. |
| `docs/forensics/rejected/note-discovery.ts` | ARCHIVED | Assumes plaintext `get_channel_info` return; upstream `EncChannelInfo` all encrypted. Zero imports in shipping path. |

Both moved to `docs/forensics/rejected/` via corrective commit `ef2a3d1`.

---

## TEST STATUS LANGUAGE

| Claim | Correct scope |
|-------|-------------|
| `npm test` → 3 passed | TEST_INFRASTRUCTURE = WORKING ✓ |
| NOT: E2EE working | E2EE not present in shipping path |
| NOT: STRK20 integration working | E2EE module removed |
| NOT: message send working | send path disconnected |
| NOT: inbox working | note-discovery removed |

---

## VERDICT: PHASE2_BLOCKED

**Reasons:**

| Blocker | Severity | Owner |
|---------|----------|-------|
| EDPH frozen baseline fails V4 (public address false positives) | HARNESS_BUG — separate workstream required | EDPH |
| Old Alchemy RPC key not revoked | MANUAL | User |
| Old GitHub PAT not revoked | MANUAL | User |
| `NEXT_PUBLIC_PROVIDER_URL` misnamed | Fix in sprint repo | Sprint |
| COMMIT04 independent verifier not verified | AUDIT — requires upstream action | Audit repo |
| COMMIT03 E2EE integration path not determined | Sprint architecture decision | Sprint |

**Sprint Phase 2 NOT authorized until:**
1. EDPH frozen baseline HARNESS_BUG resolved (separate workstream)
2. User manually revokes Alchemy + GitHub PAT and confirms
3. `RPC_API_KEY` (not `NEXT_PUBLIC_*`) for secret RPC credentials
4. COMMIT04 independent verifier confirmed or sprint adopts SDK route directly
5. Sprint architecture decision: use SDK `privacy-msg-v2` package directly vs. copy source

---
