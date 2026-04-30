"use client";

import { useEffect, useState } from "react";
import ListingCard from "../components/ListingCard";
import { createReview } from "../library/api";
import {
  addresses,
  connectWallet,
  getEthereumProvider,
  getWriteContracts,
  toTokenAmount,
} from "../library/contracts";
import { fetchUserListingSets, type ListingData } from "../library/market";

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [sellerListings, setSellerListings] = useState<ListingData[]>([]);
  const [buyerListings, setBuyerListings] = useState<ListingData[]>([]);

  const [newTitle, setNewTitle] = useState("Gaming Achievement");
  const [newDescription, setNewDescription] = useState(
    "Describe the item, service, bounty, or achievement here."
  );
  const [newPrice, setNewPrice] = useState("100");
  const [newListingType, setNewListingType] = useState("0");

  const [reviewListingId, setReviewListingId] = useState<number | null>(null);
  const [reviewTargetWallet, setReviewTargetWallet] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");

  const [rejectListingId, setRejectListingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [activeActionListingId, setActiveActionListingId] = useState<number | null>(null);
  const [cardStatusText, setCardStatusText] = useState<Record<number, string>>({});
  const [statusText, setStatusText] = useState(
    "Connect your wallet to load dashboard activity."
  );

  const isBounty = newListingType === "1";
  const amountLabel = isBounty ? "Reward / Payout (YODA)" : "Price (YODA)";
  const amountError = isBounty
    ? "Reward must be greater than 0."
    : "Price must be greater than 0.";
  const submitLabel = walletAddress
    ? isBounty
      ? "Post Bounty"
      : "Create Listing"
    : "Connect Wallet First";

  function setCardStatus(listingId: number, message: string) {
    setCardStatusText((current) => ({
      ...current,
      [listingId]: message,
    }));
  }

  async function loadDashboard(address: string) {
    setLoading(true);

    try {
      const data = await fetchUserListingSets(address);
      setSellerListings(data.sellerListings);
      setBuyerListings(data.buyerListings);
      setStatusText("Dashboard synced.");
    } catch (error: any) {
      setStatusText(error.message || "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function connectAndLoad() {
    try {
      const session = await connectWallet();
      setWalletAddress(session.address);
      await loadDashboard(session.address);
    } catch (error: any) {
      setStatusText(error.message || "Wallet connection failed.");
    }
  }

  async function createListing() {
    if (!walletAddress) {
      setStatusText("Connect your wallet before creating a listing.");
      return;
    }

    if (!newTitle.trim()) {
      setStatusText("Title is required.");
      return;
    }

    if (!newDescription.trim()) {
      setStatusText("Description is required.");
      return;
    }

    if (!newPrice.trim() || Number(newPrice) <= 0) {
      setStatusText(amountError);
      return;
    }

    setLoading(true);

    try {
      const { marketplace } = await getWriteContracts();
      const priceAmount = await toTokenAmount(newPrice);

      const metadata = JSON.stringify({
        title: newTitle.trim(),
        description: newDescription.trim(),
      });

      const tx = await marketplace.createListing(
        priceAmount,
        metadata,
        Number(newListingType)
      );

      setStatusText(isBounty ? "Posting bounty..." : "Creating listing...");
      await tx.wait();

      setStatusText(
        isBounty
          ? "Bounty posted. Approve the reward, then approve a worker request."
          : "Listing created. Buyers can now request it."
      );

      await loadDashboard(walletAddress);
    } catch (error: any) {
      setStatusText(
        error.shortMessage ||
          error.message ||
          (isBounty ? "Post bounty failed." : "Create listing failed.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function approveReward(listing: ListingData) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before approving a bounty reward.");
      setCardStatus(listing.id, "Connect your wallet first.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(listing.id);
    setCardStatus(listing.id, "Waiting for wallet approval...");

    try {
      const { token } = await getWriteContracts();
      const tx = await token.approve(addresses.escrow, listing.priceRaw);

      setStatusText(`Approving reward for bounty #${listing.id}...`);
      setCardStatus(listing.id, "Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setStatusText(`Reward approved for bounty #${listing.id}.`);
      setCardStatus(listing.id, "Reward approved. Now approve a requester.");

      await loadDashboard(walletAddress);
    } catch (error: any) {
      const message =
        error.shortMessage || error.message || "Reward approval failed.";
      setStatusText(message);
      setCardStatus(listing.id, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  async function approveRequester(listingId: number, requester: string) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before approving a requester.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(listingId);
    setCardStatus(listingId, `Approving ${requester}...`);

    try {
      const { marketplace } = await getWriteContracts();
      const tx = await marketplace.approveRequester(BigInt(listingId), requester);

      setCardStatus(listingId, "Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setStatusText(`Requester approved for listing #${listingId}.`);
      setCardStatus(listingId, "Requester approved. They can now fund escrow.");

      await loadDashboard(walletAddress);
    } catch (error: any) {
      const message =
        error.shortMessage || error.message || "Approve requester failed.";
      setStatusText(message);
      setCardStatus(listingId, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  async function fundApprovedListing(listing: ListingData) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before funding escrow.");
      setCardStatus(listing.id, "Connect your wallet first.");
      return;
    }

    if (listing.approvedBuyer.toLowerCase() !== walletAddress.toLowerCase()) {
      setStatusText("You are not approved for this listing.");
      setCardStatus(listing.id, "You are not approved for this listing.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(listing.id);
    setCardStatus(listing.id, "Preparing escrow funding...");

    try {
      const { escrow, token } = await getWriteContracts();

      if (listing.listingType === 0) {
        setCardStatus(listing.id, "Approving YODA payment...");
        const approveTx = await token.approve(addresses.escrow, listing.priceRaw);
        await approveTx.wait();
      }

      const tx = await escrow.fundEscrow(BigInt(listing.id));

      setStatusText(`Funding escrow for listing #${listing.id}...`);
      setCardStatus(listing.id, "Funding escrow. Waiting for confirmation...");
      await tx.wait();

      setStatusText(`Escrow funded for listing #${listing.id}.`);
      setCardStatus(listing.id, "Escrow funded.");

      await loadDashboard(walletAddress);
    } catch (error: any) {
      const message = error.shortMessage || error.message || "Fund escrow failed.";
      setStatusText(message);
      setCardStatus(listing.id, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  async function submitWork(listingId: number) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before submitting work.");
      setCardStatus(listingId, "Connect your wallet first.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(listingId);
    setCardStatus(listingId, "Waiting for wallet approval...");

    try {
      const { escrow } = await getWriteContracts();
      const tx = await escrow.submitWork(BigInt(listingId));

      setStatusText(`Submitting work for listing #${listingId}...`);
      setCardStatus(listingId, "Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setStatusText(`Work submitted for listing #${listingId}.`);
      setCardStatus(listingId, "Work submitted. Waiting for confirmation or rejection.");
      await loadDashboard(walletAddress);
    } catch (error: any) {
      const message = error.shortMessage || error.message || "Submit work failed.";
      setStatusText(message);
      setCardStatus(listingId, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  function openRejectForm(listingId: number) {
    setRejectListingId(listingId);
    setRejectReason("");
    setCardStatus(listingId, "Enter a reason for rejection above.");
  }

  async function submitRejectWork() {
    if (!walletAddress || !rejectListingId) {
      setStatusText("Choose a submitted listing to reject.");
      return;
    }

    if (!rejectReason.trim()) {
      setStatusText("Reject reason is required.");
      setCardStatus(rejectListingId, "Reject reason is required.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(rejectListingId);
    setCardStatus(rejectListingId, "Waiting for wallet approval...");

    try {
      const { escrow } = await getWriteContracts();
      const tx = await escrow.rejectWork(BigInt(rejectListingId), rejectReason.trim());

      setStatusText(`Rejecting work for listing #${rejectListingId}...`);
      setCardStatus(rejectListingId, "Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setStatusText(`Work rejected for listing #${rejectListingId}.`);
      setCardStatus(rejectListingId, "Work rejected once. Submitter can resubmit.");
      setRejectListingId(null);
      setRejectReason("");

      await loadDashboard(walletAddress);
    } catch (error: any) {
      const message = error.shortMessage || error.message || "Reject work failed.";
      setStatusText(message);
      setCardStatus(rejectListingId, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  async function confirmCompletion(listingId: number) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before confirming completion.");
      setCardStatus(listingId, "Connect your wallet first.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(listingId);
    setCardStatus(listingId, "Waiting for wallet approval...");

    try {
      const { escrow } = await getWriteContracts();
      const tx = await escrow.confirmCompletion(BigInt(listingId));

      setStatusText(`Confirming completion for listing #${listingId}...`);
      setCardStatus(listingId, "Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      setStatusText(`Completion confirmed for listing #${listingId}.`);
      setCardStatus(listingId, "Completion confirmed. Funds released.");
      await loadDashboard(walletAddress);
    } catch (error: any) {
      const message =
        error.shortMessage || error.message || "Confirm completion failed.";
      setStatusText(message);
      setCardStatus(listingId, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  function openReviewForm(listing: ListingData) {
    if (!walletAddress) {
      setStatusText("Connect your wallet before leaving a review.");
      setCardStatus(listing.id, "Connect your wallet first.");
      return;
    }

    const current = walletAddress.toLowerCase();
    const seller = listing.seller.toLowerCase();
    const buyer = listing.buyer.toLowerCase();

    let reviewedWallet = "";

    if (current === seller && !listing.buyerZero) {
      reviewedWallet = listing.buyer;
    } else if (current === buyer) {
      reviewedWallet = listing.seller;
    } else {
      setStatusText("Only listing participants can leave reviews.");
      setCardStatus(listing.id, "Only listing participants can leave reviews.");
      return;
    }

    setReviewListingId(listing.id);
    setReviewTargetWallet(reviewedWallet);
    setReviewRating("5");
    setReviewComment("");
    setStatusText(`Writing review for listing #${listing.id}.`);
    setCardStatus(listing.id, "Review form opened above.");
  }

  async function submitReview() {
    if (!walletAddress) {
      setStatusText("Connect your wallet before leaving a review.");
      return;
    }

    if (!reviewListingId || !reviewTargetWallet) {
      setStatusText("Choose a completed deal to review.");
      return;
    }

    if (!reviewComment.trim()) {
      setStatusText("Review comment is required.");
      setCardStatus(reviewListingId, "Review comment is required.");
      return;
    }

    setLoading(true);
    setActiveActionListingId(reviewListingId);
    setCardStatus(reviewListingId, "Saving review...");

    try {
      await createReview({
        reviewerWallet: walletAddress,
        reviewedWallet: reviewTargetWallet,
        listingId: reviewListingId,
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
      });

      setStatusText("Review submitted.");
      setCardStatus(reviewListingId, "Review submitted.");
      setReviewListingId(null);
      setReviewTargetWallet("");
      setReviewComment("");
      setReviewRating("5");
    } catch (error: any) {
      const message = error.message || "Could not submit review.";
      setStatusText(message);
      setCardStatus(reviewListingId, message);
    } finally {
      setLoading(false);
      setActiveActionListingId(null);
    }
  }

  function canReview(listing: ListingData) {
    if (!walletAddress) return false;
    if (listing.status !== 4) return false;
    if (listing.buyerZero) return false;

    const current = walletAddress.toLowerCase();

    return (
      current === listing.seller.toLowerCase() ||
      current === listing.buyer.toLowerCase()
    );
  }

  function getSellerAction(listing: ListingData) {
    const isListingBounty = listing.listingType === 1;

    if (isListingBounty && listing.status === 1) {
      return {
        label: "Approve Reward",
        action: () => approveReward(listing),
      };
    }

    if (!listing.approvedBuyerZero && listing.status === 1) {
      return null;
    }

    if (!isListingBounty && listing.status === 2) {
      return {
        label: "Submit Delivery",
        action: () => submitWork(listing.id),
      };
    }

    if (isListingBounty && listing.status === 3) {
      return {
        label: "Confirm Bounty",
        action: () => confirmCompletion(listing.id),
        secondaryLabel: "Reject Work",
        secondaryAction: () => openRejectForm(listing.id),
      };
    }

    if (canReview(listing)) {
      return {
        label: "Leave Review",
        action: () => openReviewForm(listing),
      };
    }

    return null;
  }

  function getBuyerAction(listing: ListingData) {
    const isListingBounty = listing.listingType === 1;
    const approved =
      walletAddress &&
      listing.approvedBuyer.toLowerCase() === walletAddress.toLowerCase();

    if (listing.status === 1 && approved) {
      return {
        label: isListingBounty ? "Fund Bounty" : "Fund Escrow",
        action: () => fundApprovedListing(listing),
      };
    }

    if (isListingBounty && listing.status === 2) {
      return {
        label: "Submit Bounty Work",
        action: () => submitWork(listing.id),
      };
    }

    if (!isListingBounty && listing.status === 3) {
      return {
        label: "Confirm Delivery",
        action: () => confirmCompletion(listing.id),
        secondaryLabel: "Reject Delivery",
        secondaryAction: () => openRejectForm(listing.id),
      };
    }

    if (canReview(listing)) {
      return {
        label: "Leave Review",
        action: () => openReviewForm(listing),
      };
    }

    return null;
  }

  useEffect(() => {
    async function hydrate() {
      const ethereum = getEthereumProvider();
      if (!ethereum) return;

      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });

        if (accounts?.length) {
          setWalletAddress(accounts[0]);
          await loadDashboard(accounts[0]);
        }
      } catch {
        // ignore hydration errors
      }
    }

    hydrate();
  }, []);

  return (
    <div className="ydash">
      <section className="ydash-hero">
        <div>
          <div className="eyebrow">DASHBOARD</div>
          <h1 className="hero-title">Your listings and active deals</h1>
          <p className="hero-subtitle">
            Manage requests, approve users, fund escrow, submit work, confirm or reject, and leave reviews.
          </p>
        </div>

        <button className="btn btn-primary" onClick={connectAndLoad} disabled={loading}>
          {walletAddress ? "Refresh Wallet Data" : "Connect Wallet"}
        </button>
      </section>

      <section className="ydash-top">
        <div className="ydash-card ydash-create">
          <div className="card-title">
            {isBounty ? "Post Bounty" : "Create Listing"}
          </div>
          <div className="card-copy">
            {isBounty
              ? "Offer a reward for someone to complete a task or achievement."
              : "Add a title, description, price, and listing type."}
          </div>

          <div className="form-stack">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isBounty ? "Beat a boss fight" : "Gaming Achievement"}
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={
                  isBounty
                    ? "Describe what someone needs to complete."
                    : "Describe what this listing is for."
                }
              />
            </div>

            <div>
              <label className="label">{amountLabel}</label>
              <input
                className="input"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="100"
              />
            </div>

            <div>
              <label className="label">Listing Type</label>
              <select
                className="input"
                value={newListingType}
                onChange={(e) => setNewListingType(e.target.value)}
              >
                <option value="0">Item Sale</option>
                <option value="1">Bounty</option>
              </select>
            </div>

            <button
              className="btn btn-primary ydash-full-btn"
              onClick={createListing}
              disabled={loading}
            >
              {loading ? "Working..." : submitLabel}
            </button>

            <div className="ydash-inline-status">{statusText}</div>
          </div>
        </div>

        <div className="ydash-card ydash-wallet">
          <div className="card-title">Wallet</div>
          <div className="card-copy">Connected account for this dashboard.</div>

          <div className="status-box mono">
            {walletAddress || "Not connected"}
          </div>
        </div>
      </section>

      {rejectListingId ? (
        <section className="ydash-card">
          <div className="card-title">Reject Work</div>
          <div className="card-copy">
            Rejection can only be used once. The submitter can resubmit after fixing the issue.
          </div>

          <div className="form-stack">
            <div>
              <label className="label">Reason</label>
              <textarea
                className="input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain what needs to be fixed."
              />
            </div>

            <button
              className="btn btn-primary ydash-full-btn"
              onClick={submitRejectWork}
              disabled={loading}
            >
              {loading ? "Working..." : "Submit Rejection"}
            </button>

            <button
              className="btn btn-secondary ydash-full-btn"
              onClick={() => setRejectListingId(null)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {reviewListingId ? (
        <section className="ydash-card">
          <div className="card-title">Leave Review</div>
          <div className="card-copy">
            Reviewing wallet: <span className="mono">{reviewTargetWallet}</span>
          </div>

          <div className="form-stack">
            <div>
              <label className="label">Rating</label>
              <select
                className="input"
                value={reviewRating}
                onChange={(e) => setReviewRating(e.target.value)}
              >
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Okay</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Bad</option>
              </select>
            </div>

            <div>
              <label className="label">Comment</label>
              <textarea
                className="input"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Write a short review."
              />
            </div>

            <button
              className="btn btn-primary ydash-full-btn"
              onClick={submitReview}
              disabled={loading}
            >
              {loading ? "Saving..." : "Submit Review"}
            </button>

            <button
              className="btn btn-secondary ydash-full-btn"
              onClick={() => setReviewListingId(null)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className="ydash-card">
        <div className="card-title">My Listings</div>
        <div className="card-copy">
          Listings and bounties created by the connected wallet.
        </div>

        {sellerListings.length ? (
          <div className="market-grid compact">
            {sellerListings.map((listing) => {
              const action = getSellerAction(listing);

              return (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  actionLabel={action?.label}
                  onAction={action?.action}
                  secondaryActionLabel={action?.secondaryLabel}
                  onSecondaryAction={action?.secondaryAction}
                  actionDisabled={loading && activeActionListingId === listing.id}
                  actionStatus={cardStatusText[listing.id]}
                  showRequesters={listing.status === 1}
                  onRequesterAction={approveRequester}
                />
              );
            })}
          </div>
        ) : (
          <div className="empty">No seller listings yet.</div>
        )}
      </section>

      <section className="ydash-card">
        <div className="card-title">My Requests / Active Deals</div>
        <div className="card-copy">
          Listings where the connected wallet is the approved buyer, buyer, or bounty worker.
        </div>

        {buyerListings.length ? (
          <div className="market-grid compact">
            {buyerListings.map((listing) => {
              const action = getBuyerAction(listing);

              return (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  actionLabel={action?.label}
                  onAction={action?.action}
                  secondaryActionLabel={action?.secondaryLabel}
                  onSecondaryAction={action?.secondaryAction}
                  actionDisabled={loading && activeActionListingId === listing.id}
                  actionStatus={cardStatusText[listing.id]}
                />
              );
            })}
          </div>
        ) : (
          <div className="empty">No buyer or worker activity yet.</div>
        )}
      </section>

      <style jsx>{`
        .ydash {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
        }

        .ydash-hero,
        .ydash-card {
          background: var(--panel);
          border: 1px solid var(--panelBorder);
          border-radius: 24px;
          padding: 28px;
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
        }

        .ydash-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }

        .ydash-hero :global(.hero-title) {
          max-width: 760px;
        }

        .ydash-hero :global(.btn) {
          flex-shrink: 0;
        }

        .ydash-top {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
          gap: 18px;
          width: 100%;
        }

        .ydash-create,
        .ydash-wallet {
          min-width: 0;
        }

        .ydash-full-btn {
          width: 100%;
        }

        .ydash-inline-status {
          border: 1px solid var(--panelBorder);
          background: rgba(7, 15, 28, 0.78);
          border-radius: 14px;
          padding: 12px 14px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.4;
        }

        .ydash-wallet :global(.status-box) {
          min-height: 120px;
          display: flex;
          align-items: center;
          word-break: break-word;
        }

        @media (max-width: 900px) {
          .ydash-hero {
            flex-direction: column;
          }

          .ydash-top {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}