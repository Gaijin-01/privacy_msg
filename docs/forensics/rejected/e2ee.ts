/**
 * privacy_msg — E2EE Cryptographic Layer
 *
 * Algorithm: ECIES-KEM + AES-256-GCM
 * - Key agreement: P-256 ECDH (NIST SP 800-56A)
 * - Key derivation: HKDF-SHA256 (RFC 5869)
 * - Encryption: AES-256-GCM (NIST SP 800-38D)
 * - Encoding: UTF-8 → bytes → encrypted bytes → felt252 calldata
 *
 * Each message uses a fresh ephemeral keypair.
 *
 * Envelope format (on-chain calldata):
 *   [ephemeral_pubkey_x: u256, ephemeral_pubkey_y: u256,
 *    nonce: 12 bytes, ciphertext+tag: variable]
 */

import { num } from "starknet";

// ─── Constants ────────────────────────────────────────────────────────────────

const AES_KEY_BYTES = 32;          // 256-bit AES key
const NONCE_BYTES = 12;           // GCM standard nonce
const TAG_BYTES = 16;             // GCM authentication tag
const PUBKEY_BYTES = 32;          // P-256 coordinate (x or y)
const PUBKEY_TOTAL = 64;          // P-256 full pubkey (x || y)

// ─── Error type ─────────────────────────────────────────────────────────────

export class E2EEError extends Error {
  readonly name = "E2EEError";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new E2EEError(message);
}

/** Check WebCrypto availability (client-side only). */
function checkSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    throw new E2EEError("WebCrypto SubtleCrypto not available (SSR?)");
  }
  return globalThis.crypto.subtle;
}

/** Encode a string to UTF-8 bytes. */
function encodeText(plaintext: string): Uint8Array {
  return new TextEncoder().encode(plaintext);
}

/** Decode UTF-8 bytes to string. */
function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Convert a bigint to a unsigned byte array of fixed length (big-endian). */
function bigintToBytes(value: bigint, length: number): Uint8Array {
  if (value < 0n) throw new E2EEError("bigint must be non-negative");
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

/** Convert bytes to bigint (big-endian, unsigned). */
function bytesToBigint(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

/** Generate cryptographically secure random bytes. */
function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

// ─── P-256 key derivation (ECDH) ────────────────────────────────────────────

/**
 * Derive a shared secret via P-256 ECDH.
 * Both keys must be P-256 curve points (32-byte x, 32-byte y coordinates).
 */
async function deriveSharedSecret(
  myPrivkey: Uint8Array,      // 32-byte scalar
  theirPubkey: Uint8Array,    // 64-byte: x || y
): Promise<Uint8Array> {
  const subtle = checkSubtle();

  // Import our private key
  const privKey = await subtle.importKey(
    "raw",
    myPrivkey.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );

  // Import their public key (uncompressed: 0x04 || x || y)
  const pubKeyRaw = new Uint8Array(65);
  pubKeyRaw[0] = 0x04;
  pubKeyRaw.set(theirPubkey, 1);
  const pubKey = await subtle.importKey(
    "raw",
    pubKeyRaw.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH: derive shared Z
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: pubKey },
    privKey,
    256,
  );
  return new Uint8Array(sharedBits);
}

// ─── HKDF ──────────────────────────────────────────────────────────────────

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const subtle = checkSubtle();
  const ikm = await subtle.importKey(
    "raw",
    prk.buffer as ArrayBuffer,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", info: info as unknown as BufferSource, salt: new Uint8Array(32) },
    ikm,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ─── AES-256-GCM ───────────────────────────────────────────────────────────

async function aesGcmEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const subtle = checkSubtle();
  const cryptoKey = await subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: nonce as unknown as BufferSource, tagLength: TAG_BYTES * 8, additionalData: aad as unknown as BufferSource },
    cryptoKey,
    plaintext as unknown as BufferSource,
  );
  return new Uint8Array(ciphertext);
}

async function aesGcmDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const subtle = checkSubtle();
  const cryptoKey = await subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  try {
    const plaintext = await subtle.decrypt(
      { name: "AES-GCM", iv: nonce as unknown as BufferSource, tagLength: TAG_BYTES * 8, additionalData: aad as unknown as BufferSource },
      cryptoKey,
      ciphertext as unknown as BufferSource,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new E2EEError("Decryption failed: authentication error");
  }
}

// ─── Felt252 encoding ───────────────────────────────────────────────────────

/**
 * Encode bytes as an array of felt252 (field element).
 * Each felt252 holds up to 31 bytes. We use little-endian for each chunk.
 */
export function bytesToFelts(data: Uint8Array): bigint[] {
  const felts: bigint[] = [];
  const CHUNK = 31;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    felts.push(bytesToBigint(chunk));
  }
  return felts;
}

/**
 * Decode felt252 array back to bytes.
 */
export function feltsToBytes(felts: bigint[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const felt of felts) {
    parts.push(bigintToBytes(felt, 31));
  }
  // Trim trailing zero bytes (they were padding)
  const total = parts.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  // Find last non-zero byte
  let lastNonZero = total - 1;
  while (lastNonZero >= 0 && result[lastNonZero] === 0) lastNonZero--;
  return result.slice(0, lastNonZero + 1);
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface EncryptedEnvelope {
  /** Ephemeral public key: 64 bytes (x || y) */
  ephemeralPubkey: Uint8Array;
  /** GCM nonce: 12 bytes */
  nonce: Uint8Array;
  /** Ciphertext || authentication tag */
  ciphertext: Uint8Array;
}

/**
 * Encrypt a plaintext message for a recipient who owns the given P-256 public key.
 *
 * @param plaintext     UTF-8 string to encrypt
 * @param recipientPubkey  64-byte recipient P-256 public key (x || y as bigint bytes)
 * @returns Encrypted envelope (ephemeral pubkey + nonce + ciphertext)
 */
export async function encryptMessage(
  plaintext: string,
  recipientPubkey: Uint8Array,
): Promise<EncryptedEnvelope> {
  assert(recipientPubkey.length === PUBKEY_TOTAL, `Recipient pubkey must be ${PUBKEY_TOTAL} bytes`);

  // 1. Generate ephemeral keypair
  const ephemeralKeyPair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable (needed for raw export)
    ["deriveBits"],
  );

  // 2. Export ephemeral public key (uncompressed: 0x04 || x || y)
  const ephemeralPubkeyRaw = await globalThis.crypto.subtle.exportKey(
    "raw",
    ephemeralKeyPair.publicKey,
  );
  const ephemeralPubkey = new Uint8Array(ephemeralPubkeyRaw);

  // 3. Export ephemeral private key for ECDH
  const ephemeralPrivkeyRaw = await globalThis.crypto.subtle.exportKey(
    "pkcs8",
    ephemeralKeyPair.privateKey,
  );
  const ephemeralPrivkey = new Uint8Array(ephemeralPrivkeyRaw);

  // 4. Derive shared secret via ECDH
  const sharedSecret = await deriveSharedSecret(ephemeralPrivkey.slice(-32), recipientPubkey);

  // 5. Derive AES key via HKDF (info = "privacy_msg/v1/aes-key")
  const info = encodeText("privacy_msg/v1/aes-key");
  const aesKeyRaw = await hkdfExpand(sharedSecret, info, AES_KEY_BYTES);

  // 6. Generate nonce
  const nonce = randomBytes(NONCE_BYTES);

  // 7. AAD = ephemeral pubkey (binds encryption to this ephemeral key)
  const aad = ephemeralPubkey;

  // 8. Encrypt
  const plaintextBytes = encodeText(plaintext);
  const ciphertextWithTag = await aesGcmEncrypt(aesKeyRaw, nonce, plaintextBytes, aad);

  return { ephemeralPubkey, nonce, ciphertext: ciphertextWithTag };
}

/**
 * Decrypt a message using the recipient's P-256 private key.
 *
 * @param envelope   Encrypted envelope
 * @param privkey    32-byte recipient P-256 private key (big-endian bigint bytes)
 * @returns Decrypted UTF-8 plaintext
 */
export async function decryptMessage(
  envelope: EncryptedEnvelope,
  privkey: Uint8Array,
): Promise<string> {
  const { ephemeralPubkey, nonce, ciphertext } = envelope;
  assert(ephemeralPubkey.length === PUBKEY_TOTAL, "Invalid ephemeral pubkey length");
  assert(nonce.length === NONCE_BYTES, "Invalid nonce length");

  // 1. Derive shared secret using our privkey and sender's ephemeral pubkey
  const sharedSecret = await deriveSharedSecret(privkey, ephemeralPubkey);

  // 2. Derive AES key (same info string as encrypt)
  const info = encodeText("privacy_msg/v1/aes-key");
  const aesKeyRaw = await hkdfExpand(sharedSecret, info, AES_KEY_BYTES);

  // 3. Decrypt (AAD = ephemeral pubkey)
  const aad = ephemeralPubkey;
  const plaintextBytes = await aesGcmDecrypt(aesKeyRaw, nonce, ciphertext, aad);

  return decodeText(plaintextBytes);
}

// ─── Calldata serialization ────────────────────────────────────────────────

/**
 * Encode an encrypted envelope to felt252 calldata for STRK20 invoke.
 * Format:
 *   [version: 1 felt = 1,
 *    x: u256 {low, high},
 *    y: u256 {low, high},
 *    nonce_len: 1 felt (always 12),
 *    nonce: 12 bytes as 12 felts,
 *    ciphertext_len: 1 felt,
 *    ciphertext: N felts]
 */
export function envelopeToCalldata(envelope: EncryptedEnvelope): string[] {
  const { ephemeralPubkey, nonce, ciphertext } = envelope;

  // P-256 x and y coordinates (each 32 bytes big-endian → split to low/high u256)
  const xBytes = ephemeralPubkey.slice(1, 33);   // skip 0x04 prefix
  const yBytes = ephemeralPubkey.slice(33, 65);

  const xLow = bytesToBigint(xBytes.slice(0, 16));
  const xHigh = bytesToBigint(xBytes.slice(16, 32));
  const yLow = bytesToBigint(yBytes.slice(0, 16));
  const yHigh = bytesToBigint(yBytes.slice(16, 32));

  // Nonce as individual bytes (felt range: 0..P-1, all byte values fit)
  const nonceFelts = Array.from(nonce).map((b) => BigInt(b));

  // Ciphertext as felt252 chunks
  const ciphertextFelts = bytesToFelts(ciphertext);

  const calldata: string[] = [
    // version
    "1",
    // ephemeral pubkey x (u256)
    xLow.toString(), xHigh.toString(),
    // ephemeral pubkey y (u256)
    yLow.toString(), yHigh.toString(),
    // nonce (12 bytes)
    ...nonceFelts.map((f) => f.toString()),
    // ciphertext length
    BigInt(ciphertextFelts.length).toString(),
    // ciphertext felts
    ...ciphertextFelts.map((f) => f.toString()),
  ];

  return calldata;
}

/**
 * Parse felt252 calldata back into an EncryptedEnvelope.
 */
export function calldataToEnvelope(
  felts: (string | bigint | number)[],
): EncryptedEnvelope {
  let idx = 0;
  const version = Number(felts[idx++]);
  assert(version === 1, `Unknown envelope version: ${version}`);

  const xLow = BigInt(felts[idx++]);
  const xHigh = BigInt(felts[idx++]);
  const yLow = BigInt(felts[idx++]);
  const yHigh = BigInt(felts[idx++]);

  // Reconstruct x and y as 32-byte big-endian
  const xBytes = [...bigintToBytes(xLow, 16), ...bigintToBytes(xHigh, 16)];
  const yBytes = [...bigintToBytes(yLow, 16), ...bigintToBytes(yHigh, 16)];

  // Ephemeral pubkey with 0x04 prefix
  const ephemeralPubkey = new Uint8Array(65);
  ephemeralPubkey[0] = 0x04;
  ephemeralPubkey.set(xBytes, 1);
  ephemeralPubkey.set(yBytes, 33);

  // Nonce (12 bytes)
  const nonce = new Uint8Array(NONCE_BYTES);
  for (let i = 0; i < NONCE_BYTES; i++) {
    nonce[i] = Number(felts[idx++]);
  }

  // Ciphertext
  const ctLen = Number(felts[idx++]);
  const ctFelts = felts.slice(idx, idx + ctLen).map((f) => BigInt(f));
  const ciphertext = feltsToBytes(ctFelts as bigint[]);

  return { ephemeralPubkey, nonce, ciphertext };
}

// ─── Key encoding utilities ─────────────────────────────────────────────────

/**
 * Parse a 64-hex-character P-256 public key (x || y) into a Uint8Array.
 * Input: "x_hex_64chars || y_hex_64chars" (128 hex chars total)
 */
export function parsePubkeyHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  assert(clean.length === 128, `Pubkey must be 128 hex chars (64 x + 64 y), got ${clean.length}`);
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Parse a 64-character hex string into a 32-byte Uint8Array (big-endian).
 * Input: "privkey_hex_64chars"
 */
export function parsePrivkeyHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  assert(clean.length === 64, `Privkey must be 64 hex chars, got ${clean.length}`);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Format a 64-byte pubkey as 128 hex chars (x || y). */
export function pubkeyToHex(pubkey: Uint8Array): string {
  assert(pubkey.length === 64, "Pubkey must be 64 bytes");
  return Array.from(pubkey)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
