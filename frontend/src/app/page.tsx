"use client";

import { useEffect, useMemo, useState } from "react";
import ListingCard from "./components/ListingCard";
import {
  addresses,
  connectWallet,
  expectedChainId,
  getEthereumProvider,
  getWriteContracts,
  hasInjectedWallet,
  shortenAddress,
  WALLET_MISSING_MESSAGE,
} from "./library/contracts";
import { fetchAllListings, type ListingData } from "./library/market";

type FilterKey = "all" | "active" | "reserved" | "sold";

export default function HomePage() {
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [statusText, setStatusText] = useState("Ready.");
  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);

  const chainOk = chainId === expectedChainId;

  async function hydrateWallet() {
    const ethereum = getEthereumProvider();

    if (!ethereum) {
      setStatusText(WALLET_MISSING_MESSAGE);
      return;
    }

    try {
      const accounts = await ethereum.request({ method: "eth_accounts" });
      const chainHex = await ethereum.request({ method: "eth_chainId" });

      setChainId(Number.parseInt(chainHex, 16));
      setWalletAddress(accounts?.[0] || "");
    } catch (error: any) {
      setStatusText(error.message || "Could not read wallet state.");
    }
  }

  async function loadListings() {
    setLoading(true);

    try {
      const all = await fetchAllListings();

      const visibleListings = all.filter((listing) => {
        const isUnapprovedActiveBounty =
          listing.listingType === 1 &&
          listing.status === 1 &&
          !listing.isFundable;

        return !isUnapprovedActiveBounty;
      });

      setListings(visibleListings);
      setStatusText(`Loaded ${visibleListings.length} listing(s).`);
    } catch (error: any) {
      setStatusText(error.message || "Could not load market.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      const session = await connectWallet();

      setWalletAddress(session.address);
      setChainId(session.chainId);
      setStatusText("Wallet connected.");

      await loadListings();
    } catch (error: any) {
      setStatusText(error.message || "Could not connect wallet.");
    }
  }

  async function requestListing(listing: ListingData) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before requesting this listing.");
      return;
    }

    if (!chainOk) {
      setStatusText("Switch to Sepolia before requesting this listing.");
      return;
    }

    if (listing.seller.toLowerCase() === walletAddress.toLowerCase()) {
      setStatusText("You cannot request your own listing.");
      return;
    }

    setLoading(true);

    try {
      const { marketplace } = await getWriteContracts();
      const tx = await marketplace.requestListing(BigInt(listing.id));

      setStatusText(
        listing.listingType === 1
          ? `Applying for bounty #${listing.id}...`
          : `Requesting item #${listing.id}...`
      );

      await tx.wait();

      setStatusText(
        listing.listingType === 1
          ? "Application sent. Wait for the creator to approve you."
          : "Request sent. Wait for the seller to approve you."
      );

      await loadListings();
    } catch (error: any) {
      setStatusText(error.shortMessage || error.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function fundApprovedListing(listing: ListingData) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before funding this listing.");
      return;
    }

    if (!chainOk) {
      setStatusText("Switch to Sepolia before funding this listing.");
      return;
    }

    const current = walletAddress.toLowerCase();

    if (listing.approvedBuyer.toLowerCase() !== current) {
      setStatusText("You are not approved for this listing.");
      return;
    }

    if (listing.listingType === 1 && !listing.isFundable) {
      setStatusText("This bounty is not ready. Creator must approve the reward.");
      return;
    }

    setLoading(true);

    try {
      const { escrow, token } = await getWriteContracts();

      if (listing.listingType === 0) {
        setStatusText(`Approving YODA for item #${listing.id}...`);
        const approveTx = await token.approve(addresses.escrow, listing.priceRaw);
        await approveTx.wait();
      }

      const tx = await escrow.fundEscrow(BigInt(listing.id));

      setStatusText(
        listing.listingType === 1
          ? `Funding bounty #${listing.id}...`
          : `Buying item #${listing.id}...`
      );

      await tx.wait();

      setStatusText(
        listing.listingType === 1
          ? `Bounty #${listing.id} accepted.`
          : `Item #${listing.id} purchased.`
      );

      await loadListings();
    } catch (error: any) {
      setStatusText(
        error.shortMessage ||
          error.message ||
          (listing.listingType === 1 ? "Accept bounty failed." : "Purchase failed.")
      );
    } finally {
      setLoading(false);
    }
  }

  function getAction(listing: ListingData) {
    if (!walletAddress) return null;

    const current = walletAddress.toLowerCase();
    const isActive = listing.status === 1;
    const isOwnListing = listing.seller.toLowerCase() === current;

    if (!isActive || isOwnListing) return null;

    if (listing.approvedBuyer.toLowerCase() === current) {
      return {
        label: listing.listingType === 1 ? "Fund Bounty" : "Buy Approved Item",
        action: () => fundApprovedListing(listing),
      };
    }

    const alreadyRequested = listing.requesters.some(
      (requester) => requester.toLowerCase() === current
    );

    if (alreadyRequested) {
      return null;
    }

    return {
      label: listing.listingType === 1 ? "Apply for Bounty" : "Request Item",
      action: () => requestListing(listing),
    };
  }

  useEffect(() => {
    hydrateWallet();
    loadListings();

    if (!hasInjectedWallet()) return;

    const ethereum = getEthereumProvider();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setWalletAddress(accounts[0] || "");
      loadListings();
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(Number.parseInt(newChainId, 16));
      loadListings();
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const filteredListings = useMemo(() => {
    if (filter === "active") {
      return listings.filter((listing) => listing.status === 1);
    }

    if (filter === "reserved") {
      return listings.filter((listing) => listing.status === 2);
    }

    if (filter === "sold") {
      return listings.filter((listing) => listing.status === 4);
    }

    return listings;
  }, [filter, listings]);

  return (
    <div className="market-page">
      <section className="market-header">
        <div>
          <div className="market-kicker">YODA MARKET</div>
          <h1 className="market-title">Browse Listings</h1>
          <p className="market-subtitle">
            Request items or apply for bounties. Sellers approve one requester before escrow funding.
          </p>
        </div>

        <div className="market-header-actions">
          <div className={`compact-pill ${chainOk ? "ok" : "bad"}`}>
            {chainId === null
              ? "Checking Network..."
              : chainOk
              ? `Sepolia • ${expectedChainId}`
              : `Wrong Chain • ${chainId}`}
          </div>

          <button className="btn btn-secondary" onClick={loadListings} disabled={loading}>
            Refresh
          </button>

          <button className="btn btn-primary" onClick={handleConnect} disabled={loading}>
            {walletAddress ? shortenAddress(walletAddress) : "Connect Wallet"}
          </button>
        </div>
      </section>

      <section className="market-toolbar">
        <div className="filter-group">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterButton>

          <FilterButton active={filter === "active"} onClick={() => setFilter("active")}>
            Active
          </FilterButton>

          <FilterButton
            active={filter === "reserved"}
            onClick={() => setFilter("reserved")}
          >
            Reserved
          </FilterButton>

          <FilterButton active={filter === "sold"} onClick={() => setFilter("sold")}>
            Sold
          </FilterButton>
        </div>

        <div className="list-count">
          {filteredListings.length} listing
          {filteredListings.length === 1 ? "" : "s"}
        </div>
      </section>

      <section className="market-listings">
        {filteredListings.length ? (
          filteredListings.map((listing) => {
            const action = getAction(listing);

            return (
              <ListingCard
                key={listing.id}
                listing={listing}
                actionLabel={action?.label}
                onAction={action?.action}
                actionDisabled={loading}
              />
            );
          })
        ) : (
          <div className="empty-market">
            <div className="empty-market-title">No approved listings yet</div>
            <div className="empty-market-copy">
              Create a listing from the dashboard, or approve a bounty reward so it
              appears here.
            </div>
          </div>
        )}
      </section>

      <section className="market-status-strip">
        <span className="market-status-label">Status</span>
        <span className="market-status-text">{statusText}</span>
      </section>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`filter-btn ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}