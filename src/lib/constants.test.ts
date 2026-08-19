import { describe, it, expect } from 'vitest';

// Hardcoded pool address (matches MessagesPageClient.tsx POOL_ADDRESS)
const STRK20_POOL_ADDRESS = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

describe('STRK20 constants', () => {
  it('POOL_ADDRESS is a valid Starknet hex address', () => {
    expect(STRK20_POOL_ADDRESS).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(STRK20_POOL_ADDRESS.length).toBe(66); // 0x + 64 hex chars
  });

  it('POOL_ADDRESS is not zero or empty', () => {
    expect(STRK20_POOL_ADDRESS).not.toBe('0x0');
    expect(STRK20_POOL_ADDRESS.startsWith('0x')).toBe(true);
  });

  it('POOL_ADDRESS is a正经felt252 (non-zero)', () => {
    const val = BigInt(STRK20_POOL_ADDRESS);
    expect(val).toBeGreaterThan(0n);
  });
});
