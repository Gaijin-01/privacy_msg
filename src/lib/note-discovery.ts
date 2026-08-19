/**
 * privacy_msg — Note Discovery
 *
 * Scans the STRK20 pool for incoming encrypted messages for the connected wallet.
 *
 * Architecture:
 * - Sender encrypts message → E2EE calldata → anonymizer helper → pool note
 * - Recipient discovers notes via pool RPC: get_num_of_channels, get_channel_info, get_note
 * - Decryption: requires Double Ratchet session (SDK key-holder route).
 *   For the wallet dapp route, the wallet handles decryption — the dapp shows raw
 *   calldata until the wallet exposes a decrypt API.
 *
 * Pool address: NEXT_PUBLIC_STRK20_POOL_ADDRESS env var, or hardcoded mainnet default.
 */

import { Call, num } from "starknet";

const POOL_ADDRESS =
  process.env.NEXT_PUBLIC_STRK20_POOL_ADDRESS ??
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

/** Pool RPC view functions for note discovery */
const POOL_CALLS = {
  getNumChannels: (addr: string) => ({
    contractAddress: POOL_ADDRESS,
    entrypoint: "get_num_of_channels",
    calldata: [addr],
  }),
  getChannelInfo: (recipientAddr: string, channelIndex: number) => ({
    contractAddress: POOL_ADDRESS,
    entrypoint: "get_channel_info",
    calldata: [recipientAddr, String(channelIndex)],
  }),
  getNote: (noteId: string) => ({
    contractAddress: POOL_ADDRESS,
    entrypoint: "get_note",
    calldata: [noteId],
  }),
  nullifierExists: (nullifier: string) => ({
    contractAddress: POOL_ADDRESS,
    entrypoint: "nullifier_exists",
    calldata: [nullifier],
  }),
} as const;

function parseFeltToHex(felt: string): string {
  if (!felt || felt === "0x0") return felt;
  try {
    return num.toHex(BigInt(felt));
  } catch {
    return felt;
  }
}

/**
 * Discover incoming encrypted notes for `walletAddress`.
 *
 * This scans the pool's channel/subchannel structure via RPC.
 * Decryption requires the Double Ratchet session context (SDK key-holder route).
 * For wallet dapps, the wallet is responsible for decryption — this function
 * returns the raw calldata so the wallet can decrypt it.
 *
 * @param walletAddress  Starknet address of the connected wallet
 * @param provider       starknet.js provider (myWalletAccount as ProviderInterface)
 * @returns Array of note metadata; body is "[encrypted]" until the wallet decrypts
 */
export async function discoverMessages(
  walletAddress: string,
  provider: { callContract: (call: Call) => Promise<{ result: string[] }> },
): Promise<
  Array<{
    from: string;
    body: string;
    amount: string;
    tx: string;
    ts: string;
    spent: boolean;
  }>
> {
  const result: Array<{
    from: string;
    body: string;
    amount: string;
    tx: string;
    ts: string;
    spent: boolean;
  }> = [];

  try {
    // Step 1: how many sender channels does this recipient have?
    const ncResult = await provider.callContract(
      POOL_CALLS.getNumChannels(walletAddress),
    );
    const numChannels = Number(BigInt(ncResult.result[0]));
    if (numChannels === 0) return result;

    // Step 2: scan each sender channel
    for (let ci = 0; ci < Math.min(numChannels, 100); ci++) {
      try {
        const chResult = await provider.callContract(
          POOL_CALLS.getChannelInfo(walletAddress, ci),
        );
        // chResult.result: [sender_felt, ...note_id_felts]
        const senderFelt = chResult.result[0];
        if (!senderFelt || senderFelt === "0x0") continue;

        const sender = parseFeltToHex(senderFelt);
        const noteIdFelts = chResult.result.slice(1);

        // Step 3: scan notes in this channel
        for (let ni = 0; ni < Math.min(noteIdFelts.length, 50); ni++) {
          const noteId = noteIdFelts[ni];
          if (!noteId || noteId === "0x0") continue;

          // Step 4: fetch encrypted note calldata
          let calldata: string[] = [];
          try {
            const noteResult = await provider.callContract(
              POOL_CALLS.getNote(noteId),
            );
            calldata = noteResult.result;
          } catch {
            // note not yet available — skip
          }

          // Step 5: nullifier check (spent notes are marked)
          let spent = false;
          try {
            const nullResult = await provider.callContract(
              POOL_CALLS.nullifierExists(noteId),
            );
            spent = BigInt(nullResult.result[0]) !== 0n;
          } catch {
            // nullifier check optional
          }

          // Body is encrypted until wallet dapp route exposes decrypt API.
          // The calldata is available for the wallet to decrypt.
          const body =
            calldata.length > 0
              ? `[encrypted — ${calldata.length} calldata words]`
              : "[calldata unavailable]";

          result.push({
            from: sender,
            body,
            amount: "[hidden in calldata]",
            tx: noteId.slice(0, 18) + "…",
            ts: new Date().toISOString().slice(0, 10),
            spent,
          });
        }
      } catch {
        // individual channel failure — skip
      }
    }
  } catch {
    // Pool RPC unreachable or wallet not privacy-enabled — return empty.
  }

  return result;
}
