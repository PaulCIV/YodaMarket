"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  connectWallet,
  expectedChainId,
  getEthereumProvider,
  hasInjectedWallet,
  shortenAddress,
  WALLET_MISSING_MESSAGE,
} from "../library/contracts";

export default function TopNav() {
  const pathname = usePathname();

  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(true);
  const [walletMessage, setWalletMessage] = useState("");

  const isCorrectChain = useMemo(() => chainId === expectedChainId, [chainId]);

  async function hydrateWallet() {
    const ethereum = getEthereumProvider();

    if (!ethereum) {
      setWalletAvailable(false);
      setWalletMessage(WALLET_MISSING_MESSAGE);
      return;
    }

    try {
      const accounts = await ethereum.request({ method: "eth_accounts" });
      const chainHex = await ethereum.request({ method: "eth_chainId" });

      setWalletAvailable(true);
      setChainId(Number.parseInt(chainHex, 16));
      setWalletAddress(accounts?.[0] || "");
      setWalletMessage("");
    } catch (error: any) {
      setWalletMessage(error.message || "Could not read wallet state.");
    }
  }

  async function handleConnect() {
    if (!hasInjectedWallet()) {
      setWalletAvailable(false);
      setWalletMessage(WALLET_MISSING_MESSAGE);
      return;
    }

    try {
      const session = await connectWallet();

      setWalletAddress(session.address);
      setChainId(session.chainId);
      setWalletAvailable(true);
      setWalletMessage("");
    } catch (error: any) {
      setWalletMessage(error.message || "Wallet connection failed.");
    }
  }

  useEffect(() => {
    hydrateWallet();

    if (!hasInjectedWallet()) return;

    const ethereum = getEthereumProvider();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setWalletAddress(accounts[0] || "");
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(Number.parseInt(newChainId, 16));
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <header className="topbar-wrap">
      <div className="container topbar">
        <div className="topbar-left">
          <Link href="/" className="brand">
            <span className="brand-dot" />
            <span>Yoda Market</span>
          </Link>

          <nav className="nav-links">
            <NavLink href="/" label="Market" active={pathname === "/"} />
            <NavLink href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />
            <NavLink href="/profile" label="Profile" active={pathname === "/profile"} />
          </nav>
        </div>

        <div className="topbar-right">
          <div className={`pill ${walletAvailable && isCorrectChain ? "ok" : "bad"}`}>
            {!walletAvailable
              ? "MetaMask Required"
              : chainId === null
              ? "Checking Network..."
              : isCorrectChain
              ? `Sepolia • ${expectedChainId}`
              : `Wrong Chain • ${chainId}`}
          </div>

          <button className="btn btn-primary" onClick={handleConnect}>
            {!walletAvailable
              ? "Install MetaMask"
              : walletAddress
              ? shortenAddress(walletAddress)
              : "Connect Wallet"}
          </button>
        </div>
      </div>

      {walletMessage ? (
        <div className="container wallet-banner">{walletMessage}</div>
      ) : null}

      <style jsx>{`
        .wallet-banner {
          margin-top: -10px;
          margin-bottom: 12px;
          color: #ffd1d1;
          font-size: 13px;
        }
      `}</style>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`nav-link ${active ? "active" : ""}`}>
      {label}
    </Link>
  );
}