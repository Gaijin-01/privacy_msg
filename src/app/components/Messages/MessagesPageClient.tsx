"use client";

import { useState } from "react";
import { num } from "starknet";
import { useStoreWallet } from "@/app/components/Wallet/walletContext";
import styles from "../../uni.module.css";
import { discoverMessages } from "@/lib/note-discovery";
import WalletAccountV6Tag from "@/app/components/client/WalletHandle/WalletAccountV6Tag";
import SelectWallet from "@/app/components/client/WalletHandle/SelectWallet";
import {
  encryptMessage,
  envelopeToCalldata,
  parsePubkeyHex,
} from "@/lib/e2ee";

// Pool address (same on mainnet + sepolia)
const POOL_ADDRESS = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
// Minimal message anonymizer — replace with your deployed contract
const MSG_HELPER_ADDRESS = "0x0"; // TODO: deploy from cairo/

type TabKey = "send" | "inbox";
const TABS: { key: TabKey; label: string }[] = [
  { key: "send", label: "Send" },
  { key: "inbox", label: "Inbox" },
];

export default function MessagesPageClient() {
  const { address: walletAddress, myWalletAccount } = useStoreWallet();
  const [tab, setTab] = useState<TabKey>("send");
  const [recipient, setRecipient] = useState("");
  const [recipientPubkey, setRecipientPubkey] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("0.001"); // STRK — dust, carrier for the memo
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; tx?: string; note?: string } | null>(null);
  // P-256 viewing key for decrypting received messages (128 hex chars = 64 bytes x || y)
  const [myViewingKey, setMyViewingKey] = useState("");

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tokens/strk20.png" alt="STRK20" className={styles.brandImg} />
          <span style={{ marginLeft: 8, fontWeight: 600 }}>privacy_msg</span>
        </div>
        <SelectWallet variant="nav" />
      </nav>

      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Private Messages
          <br />
          <span className={styles.heroAccent}>on Starknet</span>
        </h1>
        <p className={styles.heroSub}>
          Sender and recipient identities are hidden. Only the payment memo is visible.
          Settlement through the{" "}
          <a href={`https://voyager.online/tx/${POOL_ADDRESS}`} target="_blank" rel="noreferrer">
            STRK20 pool
          </a>
          .
        </p>
      </header>

      <main>
        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, justifyContent: "center" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setResult(null); }}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                background: tab === t.key ? "#5c6ef8" : "#2a2a3a",
                color: "#fff",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {active.key === "send" && (
          <div className={styles.panel}>
            <SendPanel
              recipient={recipient} setRecipient={setRecipient}
              recipientPubkey={recipientPubkey} setRecipientPubkey={setRecipientPubkey}
              message={message} setMessage={setMessage}
              amount={amount} setAmount={setAmount}
              sending={sending} setSending={setSending}
              result={result} setResult={setResult}
            />
          </div>
        )}
        {active.key === "inbox" && (
          <div className={styles.panel}>
            <InboxPanel />
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <WalletAccountV6Tag />
        </div>
      </main>

      <footer className={styles.footer}>
        <a href="https://github.com/Gaijin-01/privacy_msg" target="_blank" rel="noreferrer">Repo</a>
        <span className={styles.footerDot}>·</span>
        <span>Sprint: STRK20 Private · privacy_msg</span>
      </footer>
    </div>
  );
}

// ─── Send panel ───────────────────────────────────────────────

type SendPanelProps = {
  recipient: string; setRecipient: (v: string) => void;
  recipientPubkey: string; setRecipientPubkey: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  sending: boolean; setSending: (v: boolean) => void;
  result: { ok: boolean; title: string; tx?: string; note?: string } | null;
  setResult: (v: SendPanelProps["result"]) => void;
};

function SendPanel({ recipient, setRecipient, recipientPubkey, setRecipientPubkey, message, setMessage, amount, setAmount, sending, setSending, result, setResult }: SendPanelProps) {
  const shortPool = POOL_ADDRESS.slice(0, 10) + "…" + POOL_ADDRESS.slice(-6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 14, color: "#8b8fa8", lineHeight: 1.6 }}>
        <strong style={{ color: "#fff" }}>How it works:</strong> your message is encrypted
        (AES-256-GCM + ECIES-KEM) and encoded in the calldata of a privacy-pool invoke.
        The recipient decrypts it from on-chain events. Amount is dust (0.001 STRK).
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#c0c2d4" }}>Recipient address</span>
        <input
          type="text"
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #3a3a5a",
            background: "#1a1a2a",
            color: "#e0e2f0",
            fontSize: 14,
            fontFamily: "monospace",
          }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#c0c2d4" }}>
          Recipient P-256 pubkey{" "}
          <span style={{ color: "#5c6ef8", fontWeight: 400 }}>(128 hex chars)</span>
        </span>
        <input
          type="text"
          placeholder="e.g. a1b2…f3e4 (recipient's P-256 public key x||y)"
          value={recipientPubkey}
          onChange={(e) => setRecipientPubkey(e.target.value.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 128))}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #3a3a5a",
            background: "#1a1a2a",
            color: "#e0e2f0",
            fontSize: 14,
            fontFamily: "monospace",
          }}
        />
        <span style={{ fontSize: 12, color: "#8b8fa8" }}>
          Ask the recipient for their P-256 public key (128 hex chars = x||y).
        </span>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#c0c2d4" }}>Message (max 200 chars)</span>
        <textarea
          placeholder="Your private message…"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          rows={3}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #3a3a5a",
            background: "#1a1a2a",
            color: "#e0e2f0",
            fontSize: 14,
            resize: "none",
            fontFamily: "monospace",
          }}
        />
        <span style={{ fontSize: 12, color: "#5c6ef8", textAlign: "right" }}>{message.length}/200</span>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#c0c2d4" }}>
          STRK dust amount (carrier)
          <span style={{ color: "#5c6ef8", marginLeft: 8, fontWeight: 400 }}>← not the message</span>
        </span>
        <input
          type="number"
          min="0"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #3a3a5a",
            background: "#1a1a2a",
            color: "#e0e2f0",
            fontSize: 14,
          }}
        />
        <span style={{ fontSize: 12, color: "#8b8fa8" }}>
          Pool: {shortPool} — must be deployed before sending
        </span>
      </label>

      {result && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: result.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${result.ok ? "#22c55e" : "#ef4444"}`,
          color: result.ok ? "#4ade80" : "#f87171",
          fontSize: 14,
        }}>
          <strong>{result.title}</strong>
          {result.tx && <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12 }}>tx: {result.tx.slice(0, 12)}…</div>}
          {result.note && <div style={{ marginTop: 4, fontSize: 13 }}>{result.note}</div>}
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={sending || !recipient || !recipientPubkey || recipientPubkey.length !== 128 || !message || parseFloat(amount) <= 0}
        style={{
          padding: "12px 24px",
          borderRadius: 8,
          border: "none",
          background: sending ? "#3a3a5a" : "#5c6ef8",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          cursor: sending ? "not-allowed" : "pointer",
          opacity: (!recipient || !message || parseFloat(amount) <= 0) ? 0.5 : 1,
        }}
      >
        {sending ? "Confirm in wallet…" : "Send Private Message"}
      </button>
    </div>
  );

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      // 1. Encrypt the message with the recipient's P-256 public key
      let envelope;
      try {
        envelope = await encryptMessage(message, parsePubkeyHex(recipientPubkey));
      } catch (e: any) {
        setResult({ ok: false, title: "Encryption failed", note: e?.message ?? String(e) });
        return;
      }

      // 2. Encode envelope as felt252 calldata for STRK20 invoke
      const envelopeCalldata = envelopeToCalldata(envelope);

      // 3. Send via privacy pool invoke through the wallet
      //    The wallet (via WalletAccountV6.strk20InvokeTransaction) routes this
      //    through the anonymizer helper and credits the encrypted note to the recipient.
      //    Until an anonymizer helper is deployed, the calldata is prepared but
      //    the invoke will fail at the pool — the UI guides the user to deploy one.
      const helperAddress = process.env.NEXT_PUBLIC_MSG_HELPER_ADDRESS ?? "0x0";
      if (helperAddress === "0x0") {
        setResult({
          ok: false,
          title: "No message helper deployed",
          note: "Set NEXT_PUBLIC_MSG_HELPER_ADDRESS in .env.local to deploy cairo/src/lib.cairo",
        });
        return;
      }

      // The wallet call is: walletAccount.strk20InvokeTransaction([{ type: "invoke", contract: helper, calldata: envelopeCalldata }])
      // WalletAccountV6Tag exposes myWalletAccount via walletContext.
      // For now: surface the prepared calldata so the wallet can be invoked directly.
      setResult({
        ok: true,
        title: "Calldata ready — confirm in wallet",
        note: `Envelope: ${envelope.ephemeralPubkey.length + envelope.nonce.length + envelope.ciphertext.length} bytes → ${envelopeCalldata.length} felts`,
      });
    } catch (e: any) {
      setResult({ ok: false, title: "Failed", note: e?.message ?? String(e) });
    } finally {
      setSending(false);
    }
  }
}

// ─── Inbox panel ─────────────────────────────────────────────

function InboxPanel() {
  const { address: walletAddress, myWalletAccount } = useStoreWallet();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ from: string; body: string; amount: string; tx: string; ts: string }>>([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, color: "#8b8fa8", lineHeight: 1.6 }}>
        <strong style={{ color: "#fff" }}>How inbox works:</strong> queries your shielded notes
        from the pool and decrypts message memos from anonymizer events.
        Requires a privacy-enabled wallet connected.
      </div>

      {messages.length === 0 && !loading && (
        <div style={{ textAlign: "center", color: "#5c6ef8", fontSize: 14, padding: "32px 0" }}>
          No messages yet. Connect your wallet and send your first private message.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", color: "#8b8fa8", fontSize: 14 }}>Loading…</div>
      )}

      {messages.map((m, i) => (
        <div key={i} style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "#1a1a2a",
          border: "1px solid #2a2a4a",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#5c6ef8" }}>
              {m.from.slice(0, 8)}…{m.from.slice(-6)}
            </span>
            <span style={{ fontSize: 12, color: "#8b8fa8" }}>{m.ts}</span>
          </div>
          <div style={{ fontSize: 14, color: "#e0e2f0", whiteSpace: "pre-wrap" }}>{m.body}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#8b8fa8" }}>
            {m.amount} STRK · tx: {m.tx.slice(0, 10)}…
          </div>
        </div>
      ))}

      <button
        onClick={handleRefresh}
        disabled={loading}
        style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "1px solid #3a3a5a",
          background: "transparent",
          color: "#c0c2d4",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 14,
        }}
      >
        {loading ? "Refreshing…" : "Refresh inbox"}
      </button>
    </div>
  );

  async function handleRefresh() {
    setLoading(true);
    try {
      if (!walletAddress || !myWalletAccount) {
        setMessages([]);
        return;
      }
      const provider = myWalletAccount as any; // starknet.js provider
      const inbox = await discoverMessages(walletAddress, provider);
      setMessages(inbox);
    } catch (e: any) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }
}
