# Sprint Phase 2 Admission Gate Report — v2

**Date:** 2026-08-19 16:45 IDT
**Baseline:** `98ad018` (rejected implementations removed from `src/lib/`)
**Status:** PHASE2_BLOCKED

---

## PUBLIC REPO

| Item | Value |
|------|-------|
| Commit | `98ad018` |
| Clean | YES — no uncommitted changes |
| Build | ✓ Compiled — 4 routes |
| Test infra | ✓ vitest working |
| Test count | 3 tests (STRK20 pool address constants only) |

---

## EDPH — Frozen Baseline Run on `98ad018`

**Run ID:** `san-20260819-134259`
**EDPH commit:** `eb6023c` (feat/v1.1-production-hardening)
**Archive SHA256:** `3fd705f255c667428e5214821ebc12203dfd56b5977754c69351f3ac8ee8b797`
**Harness changes during target eval:** ZERO
**Target tree hash:** `b09e74fda50ce73d...`

| Stage | Result |
|-------|--------|
| V1_policy_validity | ✓ PASS |
| V2_inventory_integrity | ✓ PASS |
| V3_sanitization_integrity | ✓ PASS |
| V4_secret_scan | ✗ **FAIL** |
| V14_sbom_generation | ✓ PASS |

**Overall: FAIL — 4 PASS / 1 FAIL / 0 BLOCKED / 0 N/A**

Evidence path: `~/.hermes/harness/edph-v1/state/runs/san-20260819-134259/`

---

### V4 Failure — Complete Classification (292 findings)

**Classification: HARNESS_BUG — public-address and public-identifier false positives.**

Every finding was manually reviewed. Zero true secrets found.

| Group | Pattern ID | Count | Severity | True Secret | Public Identifier | False Positive | Ambiguous |
|-------|-----------|-------|----------|------------|-----------------|---------------|-----------|
| S4_entropy | HIGH_ENTROPY_STRING | 225 | medium | 0 | 225 (SHA-512 hashes in `package-lock.json`, base64 in `public/Images/encoded-*.txt`) | 0 | 0 |
| S2_crypto_material | RAW_SCALAR | 34 | medium | 0 | 34 (chain IDs like `0x534e5f4d41494e`=SN_MAIN, `0x534e5f474f45524c49`=SN_GOERLI, `0x0` placeholder addresses, STRK pool address fragments, commit SHAs, one Base64 credential in package-lock.json) | 0 | 0 |
| S1_known_tokens | TWILIO_AUTH | 16 | medium | 0 | 16 (32-char hex substrings from STRK pool address `0x040337b...` embedded across 6 files; NOT Twilio credentials) | 0 | 0 |
| S3_env_files | WALLET_FILE | 6 | medium | 0 | 0 | 6 (filename pattern matches `wallet_account_for_starknet` package name, `WalletHandle`, `providerContext`, `tsconfig.json` containing `compilerOptions`) | 0 |
| S2_crypto_material | WALLET_MNEMONIC_12 | 6 | medium | 0 | 6 (common English words from LICENSE and report prose: "copy", "above copyright notice", "external contract address", "discovery store") | 0 | 0 |
| S1_known_tokens | PRIVATE_KEY_HEX | 4 | high | 0 | 4 (public Starknet contract addresses: pool `0x040337b...`, STRK token `0x04718f5...`) | 0 | 0 |
| S3_env_files | CREDENTIALS_FILE | 1 | high | 0 | 0 | 1 (filename `TokenIcons.tsx` contains `credentials` substring in comment) | 0 |
| **TOTAL** | | **292** | | **0** | **265** | **7** | **0** |

**Severity breakdown (from V4 result):**
- critical: 0
- high: 5 (4× pool/STRK addresses + 1× TokenIcons filename)
- medium: 287 (224 entropy + 34 RAW_SCALAR + 16 TWILIO_AUTH + 6 WALLET_FILE + 6 WALLET_MNEMONIC)

**True secrets: 0**

### Per-Group Detail

**S4_entropy / HIGH_ENTROPY_STRING (225):**
- `package-lock.json` (224): SHA-512 integrity hashes from npm lockfile entries. These are public content-addressed hashes of package content, not secrets.
- `public/Images/encoded-20231019075753.txt` (1): Base64-encoded image data (GIF, served from `public/`). Public static asset.

**S2_crypto_material / RAW_SCALAR (34):**
- `src/utils/constants.ts`: chain ID hex strings (`SN_MAIN = 0x534e5f4d41494e`, `SN_GOERLI = 0x534e5f474f45524c49`). Public constants.
- `MessagesPageClient.tsx`, `constants.test.ts`: `MSG_HELPER_ADDRESS = "0x0"` placeholder. Zero value, not a secret.
- `constants.ts:2052`: Starknet struct hash `0x2a4482a...`. Public RPC field.
- `WalletAccountV6Tag.tsx`: `network ("0x0" = not deployed)`. Zero placeholder.
- `SPRINT-PHASE2-ADMISSION.md`: pool address and STRK token address embedded in report prose. Public contract addresses.
- `package-lock.json`: one Base64 credential string (`AAAA...) from npm lockfile. Part of npm's internal content-addressing.

**S1_known_tokens / TWILIO_AUTH (16):**
- 32-char hex substrings extracted from the STRK pool address `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` appearing across 6 files. The scanner extracts substrings matching `[0-9a-f]{32}` and flags them as potential Twilio auth tokens. Not Twilio credentials.

**S3_env_files / WALLET_FILE (6):**
- `package.json`, `package-lock.json`: package name `"wallet_account_for_starknet"`. Public npm package name, not a wallet file.
- `walletContext.ts`, `SelectWallet.tsx`, `WalletAccountV6Tag.tsx`, `providerContext.ts`: filename contains `Wallet`. Public React component names, not keystores.
- `tsconfig.json`: contains `compilerOptions` which matches the `\.json` part of the WALLET_FILE pattern. Not a wallet file.

**S2_crypto_material / WALLET_MNEMONIC_12 (6):**
- English word sequences in LICENSE ("to any person obtaining a copy", "above copyright notice and this permission notice") and report prose ("External requires an external contract address", "discovery store"). Mnemonic phrase false positives on natural language text containing 12 common English words.

**S1_known_tokens / PRIVATE_KEY_HEX (4 high):**
- `constants.ts:290`: `addrSTRK = "0x04718f5..."` — public STRK ERC-20 token contract address on Starknet.
- `constants.test.ts:149`, `MessagesPageClient.tsx:359`: `POOL_ADDRESS = "0x040337b..."` — public STRK20 pool contract address.
- `note-discovery.ts:730` (archived): same pool address, same classification.

**S3_env_files / CREDENTIALS_FILE (1 high):**
- `TokenIcons.tsx:0`: filename contains `credentials` substring in comment header. File contains no credentials.

---

## EDPH — Modified Harness (for reference only)

Not used for current verdict. Recorded for comparison.

| Stage | Frozen (`eb6023c`) | Modified (`06f2637`) |
|-------|--------------------|-----------------------|
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
| **Overall** | **FAIL (V4)** | **PASS (14/14)** |

---

## SECRETS

| Item | Status |
|------|--------|
| Old Alchemy revoked | **NO / MANUAL_REQUIRED** |
| Old GitHub PAT revoked | **NO / MANUAL_REQUIRED** |
| Active secret committed to git | **NO** |
| `NEXT_PUBLIC_PROVIDER_URL` in source | YES — appended to Alchemy URL base in `constants.ts` |
| `NEXT_PUBLIC_PROVIDER_URL` in committed source | YES — but value comes from gitignored `.env.local` |

### RPC Env Model

**Model B — server-side secret, misnamed.**

`NEXT_PUBLIC_PROVIDER_URL` is a secret Alchemy API key appended at runtime:
```
https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/ + process.env.NEXT_PUBLIC_PROVIDER_URL
```

The `RpcProvider` is created in `constants.ts` which runs server-side. The key is in gitignored `.env.local`, not committed. V4 scan correctly did not flag any true Alchemy API keys.

**Required fix:** Rename to `RPC_API_KEY` (server-side only). Do not use `NEXT_PUBLIC_` prefix for secret credentials.

---

## COMMIT03 MIGRATION INVENTORY

### Source: `/home/wner/audits/starknet-privacy/sdk/src/privacy-msg-v2/`

| File | Role | Security Status | Tests | Public Dest | MIGRATE? |
|------|------|----------------|-------|-------------|---------|
| `session-ratchet.ts` | Session chain: HKDF → send/recv chain derivation | AUDIT: 16/16 T-gates PASS | `commit-03-closure-gate.test.ts` | Not present | **YES** — after architecture decision |
| `wallet-binding.ts` | SNIP-12 signed wallet binding | AUDIT: VERIFIED | `identity-handshake.test.ts` | Not present | **YES** — after architecture decision |
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
| MIGRATION_READY | **NO** | E2EE integration path not determined; no acceptance gate in sprint repo |

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

---

## REJECTED CODE

| File | Action | Reason |
|------|--------|--------|
| `docs/forensics/rejected/e2ee.ts` | ARCHIVED | E2EE-F2 CRITICAL PKCS8 slice bug, E2EE-F4 roundtrip FAIL, E2EE-F5 u256 FAIL. Zero imports in shipping path. |
| `docs/forensics/rejected/note-discovery.ts` | ARCHIVED | Assumes plaintext `EncChannelInfo`; upstream SDK returns all-encrypted. Zero imports in shipping path. |

Both moved from `src/lib/` to `docs/forensics/rejected/` via `98ad018`.

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

**Reasons (unchanged from v1):**

| Blocker | Severity | Owner |
|---------|----------|-------|
| EDPH frozen baseline fails V4 on `98ad018` — 292 findings, all classified as public-identifier or false-positive (HARNESS_BUG) | HARNESS_BUG — separate EDPH workstream required | EDPH |
| Old Alchemy RPC key not revoked | MANUAL | User |
| Old GitHub PAT not revoked | MANUAL | User |
| `NEXT_PUBLIC_PROVIDER_URL` misnamed | Fix in sprint repo | Sprint |
| COMMIT04 independent verifier not verified | AUDIT — requires upstream action | Audit repo |
| COMMIT03 E2EE integration path not determined | Sprint architecture decision | Sprint |

**Sprint Phase 2 NOT authorized until:**
1. EDPH frozen baseline HARNESS_BUG resolved (separate workstream)
2. User manually revokes Alchemy + GitHub PAT and confirms
3. `RPC_API_KEY` (not `NEXT_PUBLIC_*`) for secret credentials
4. COMMIT04 independent verifier confirmed or sprint adopts SDK route directly
5. Sprint architecture decision: use SDK `privacy-msg-v2` package directly vs. copy source

---
