"use client";

import type { CSSProperties } from "react";
import styles from "./uni.module.css";
import SelectWallet from "./components/client/WalletHandle/SelectWallet";
import WalletAccountV6Tag from "./components/client/WalletHandle/WalletAccountV6Tag";
import { StrkCoin, BtcCoin, EthCoin, UsdcCoin, ZecCoin } from "./components/TokenIcons";

type BgToken = {
  Coin: (p: { size?: number }) => React.ReactElement;
  pos: CSSProperties;
  size: number;
  blur: number;
  opacity: number;
};
const BG_TOKENS: BgToken[] = [
  { Coin: StrkCoin, pos: { top: "30%", left: "3%" }, size: 116, blur: 5, opacity: 0.55 },
  { Coin: BtcCoin, pos: { top: "38%", left: "18%" }, size: 92, blur: 4, opacity: 0.5 },
  { Coin: ZecCoin, pos: { top: "64%", left: "9%" }, size: 140, blur: 6, opacity: 0.5 },
  { Coin: EthCoin, pos: { top: "11%", left: "22%" }, size: 84, blur: 4, opacity: 0.5 },
  { Coin: UsdcCoin, pos: { top: "86%", left: "20%" }, size: 104, blur: 5, opacity: 0.5 },
  { Coin: EthCoin, pos: { top: "7%", right: "18%" }, size: 128, blur: 5, opacity: 0.55 },
  { Coin: BtcCoin, pos: { top: "12%", right: "4%" }, size: 96, blur: 4, opacity: 0.5 },
  { Coin: StrkCoin, pos: { top: "54%", right: "6%" }, size: 132, blur: 6, opacity: 0.55 },
  { Coin: UsdcCoin, pos: { top: "76%", right: "9%" }, size: 104, blur: 5, opacity: 0.5 },
  { Coin: ZecCoin, pos: { top: "88%", right: "20%" }, size: 100, blur: 5, opacity: 0.48 },
  { Coin: BtcCoin, pos: { top: "5%", left: "42%" }, size: 116, blur: 5, opacity: 0.45 },
  { Coin: StrkCoin, pos: { bottom: "-1%", left: "48%" }, size: 124, blur: 6, opacity: 0.48 },
];

export default function Page() {
  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden>
        {BG_TOKENS.map((t, i) => (
          <span
            key={i}
            className={styles.tok}
            style={{ ...t.pos, filter: `blur(${t.blur}px)`, opacity: t.opacity }}
          >
            <t.Coin size={t.size} />
          </span>
        ))}
      </div>

      <nav className={styles.nav}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tokens/strk20.png" alt="STRK20" className={styles.brandImg} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/messages"
            style={{ color: "#c0c2d4", textDecoration: "none", fontWeight: 600, fontSize: 14 }}
          >
            Messages
          </a>
          <SelectWallet variant="nav" />
        </div>
      </nav>

      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>
          privacy_msg
          <br />
          <span className={styles.heroAccent}>Private Messaging</span>
        </h1>
        <p className={styles.heroSub}>
          Metadata-resistant private messages on Starknet. Sender and recipient identities
          are hidden — only the payment memo is visible. Settlement through the STRK20 pool.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 16, justifyContent: "center" }}>
          <a
            href="/messages"
            style={{
              padding: "12px 28px",
              borderRadius: 10,
              background: "#5c6ef8",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            Open Messages
          </a>
          <a
            href="https://github.com/Gaijin-01/privacy_msg"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "12px 28px",
              borderRadius: 10,
              border: "1px solid #3a3a5a",
              color: "#c0c2d4",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            GitHub
          </a>
        </div>
      </header>

      <main>
        <WalletAccountV6Tag />
      </main>

      <footer className={styles.footer}>
        <a href="https://github.com/Gaijin-01/privacy_msg" target="_blank" rel="noreferrer">
          Repo
        </a>
        <span className={styles.footerDot}>·</span>
        <span>STRK20 Private Sprint · privacy_msg</span>
      </footer>
    </div>
  );
}
