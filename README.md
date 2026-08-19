# privacy_msg

Metadata-resistant private messaging on Starknet.

**Visible:** payment memo attached to every message.  
**Invisible:** sender-recipient link, message content, recipient identity.  
**Settlement:** every transfer routes through the STRK20 pool at `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`.

## Architecture

Built on the [STRK20 privacy SDK](https://github.com/starknetworks/strk20-privacy-sdk). Each session uses an ephemeral identity bundle derived from a master seed — no persistent wallet linkage at the application layer.

## Status

In active development. Target: end-to-end private message on Starknet mainnet by 2026-08-31.

## References

- [STRK20 by Example](https://strk20-by-example.org/what-is-strk20)
- [STRK20 Privacy SDK](https://github.com/starknetworks/starknet-privacy)
- [Starknet Wallet API](https://starknet-js.com/docs/next/guides/account/walletAccount)
- [Starter Kit](https://github.com/Akashneelesh/strk20-starter-kit)
- [Awesome STRK20](https://github.com/Akashneelesh/awesome-strk20)
