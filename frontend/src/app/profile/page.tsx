"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfile, getReviews, updateProfile, type Review } from "../library/api";
import {
  connectWallet,
  getEthereumProvider,
  hasInjectedWallet,
  shortenAddress,
} from "../library/contracts";
import { fetchUserListingSets } from "../library/market";

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [displayName, setDisplayName] = useState("Unnamed Player");
  const [description, setDescription] = useState("No profile description added yet.");
  const [reviews, setReviews] = useState<Review[]>([]);

  const [listingsCreated, setListingsCreated] = useState(0);
  const [activeDeals, setActiveDeals] = useState(0);
  const [completedDeals, setCompletedDeals] = useState(0);
  const [cancelledDeals, setCancelledDeals] = useState(0);

  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState(
    "Connect your wallet to view your reputation profile."
  );

  const averageRating =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  const hasAnyActivity =
    listingsCreated > 0 || activeDeals > 0 || completedDeals > 0 || cancelledDeals > 0;

  async function loadProfile(address: string) {
    try {
      const profile = await getProfile(address);
      console.log("FRONTEND PROFILE ADDRESS:", address);
      console.log("PROFILE FROM BACKEND:", profile);

      setWalletAddress(address);
      setDisplayName(profile.display_name || "Unnamed Player");
      setDescription(profile.description || "No profile description added yet.");
      setStatusText("Profile loaded.");

      try {
        const reviewData = await getReviews(address);
        setReviews(reviewData);
      } catch {
        setReviews([]);
      }

      try {
        const listingData = await fetchUserListingSets(address);
        const allListings = [
          ...listingData.sellerListings,
          ...listingData.buyerListings,
        ];

        setListingsCreated(listingData.sellerListings.length);
        setActiveDeals(
          allListings.filter(
            (listing) => listing.status === 1 || listing.status === 2
          ).length
        );
        setCompletedDeals(
          allListings.filter(
            (listing) => listing.status === 3 || listing.status === 4
          ).length
        );
        setCancelledDeals(
          allListings.filter((listing) => listing.status === 5).length
        );

        setStatusText("Profile synced.");
      } catch {
        setListingsCreated(0);
        setActiveDeals(0);
        setCompletedDeals(0);
        setCancelledDeals(0);
        setStatusText("Profile loaded. Contract stats are unavailable.");
      }
    } catch (error: any) {
      setStatusText(error.message || "Could not load profile.");
    }
  }

  async function connectAndLoad() {
    try {
      const session = await connectWallet();
      await loadProfile(session.address);
    } catch (error: any) {
      setStatusText(error.message || "Wallet connection failed.");
    }
  }

  async function saveProfile() {
    if (!walletAddress) {
      setStatusText("Connect your wallet before saving profile changes.");
      return;
    }

    if (!displayName.trim()) {
      setStatusText("Display name is required.");
      return;
    }

    setSaving(true);

    try {
      const updated = await updateProfile(
        walletAddress,
        displayName.trim(),
        description.trim() || "No profile description added yet."
      );

      setDisplayName(updated.display_name || "Unnamed Player");
      setDescription(updated.description || "No profile description added yet.");
      setStatusText("Profile updated.");
    } catch (error: any) {
      setStatusText(error.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function hydrate() {
      if (!hasInjectedWallet()) return;

      const ethereum = getEthereumProvider();
      if (!ethereum) return;

      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });

        if (accounts?.length) {
          await loadProfile(accounts[0]);
        }
      } catch {
        // ignore hydration errors
      }
    }

    hydrate();

    const ethereum = getEthereumProvider();
    if (!ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts?.length) {
        await loadProfile(accounts[0]);
      } else {
        setWalletAddress("");
        setStatusText("Connect your wallet to view your reputation profile.");
      }
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return (
    <div className="yprofile">
      <section className="yprofile-hero">
        <div>
          <div className="eyebrow">PROFILE</div>
          <h1 className="hero-title">Reviews and reputation</h1>
          <p className="hero-subtitle">
            A wallet-based reputation page for buyer and seller trust.
          </p>
        </div>

        <button className="btn btn-primary" onClick={connectAndLoad}>
          {walletAddress ? "Refresh Profile" : "Connect Wallet"}
        </button>
      </section>

      <section className="yprofile-grid">
        <div className="yprofile-card yprofile-main">
          <div className="profile-header">
            <div className="profile-avatar">
              {displayName.slice(0, 1).toUpperCase()}
            </div>

            <div>
              <div className="profile-name">{displayName}</div>
              <div className="profile-wallet mono">
                {walletAddress ? shortenAddress(walletAddress) : "Not connected"}
              </div>
            </div>
          </div>

          <div className="profile-section">
            <label className="label">Display Name</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />

            <label className="label profile-description-label">Description</label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <button
              className="btn btn-primary profile-save-btn"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="yprofile-card reputation-card">
          <div className="card-title">Reputation</div>
          <div className="rating-number">{averageRating.toFixed(1)}</div>
          <div className="rating-stars">{renderStars(averageRating)}</div>
          <div className="card-copy">
            Based on {reviews.length} review{reviews.length === 1 ? "" : "s"}.
          </div>
        </div>
      </section>

      <section className="profile-stats-grid">
        {listingsCreated > 0 ? (
          <Link href="/dashboard" className="profile-stat-card clickable">
            <div className="profile-stat-label">Listings Created</div>
            <div className="profile-stat-value">{listingsCreated}</div>
            <div className="profile-stat-copy">View your listings</div>
          </Link>
        ) : null}

        {activeDeals > 0 ? (
          <Link href="/dashboard" className="profile-stat-card clickable">
            <div className="profile-stat-label">Active Deals</div>
            <div className="profile-stat-value">{activeDeals}</div>
            <div className="profile-stat-copy">Reserved or active</div>
          </Link>
        ) : null}

        {completedDeals > 0 ? (
          <Link href="/dashboard" className="profile-stat-card clickable">
            <div className="profile-stat-label">Completed Deals</div>
            <div className="profile-stat-value">{completedDeals}</div>
            <div className="profile-stat-copy">Completed or sold</div>
          </Link>
        ) : null}

        {cancelledDeals > 0 ? (
          <div className="profile-stat-card">
            <div className="profile-stat-label">Cancelled Deals</div>
            <div className="profile-stat-value">{cancelledDeals}</div>
            <div className="profile-stat-copy">Cancelled listings</div>
          </div>
        ) : null}

        {!hasAnyActivity ? (
          <div className="profile-stat-card">
            <div className="profile-stat-label">No Activity Yet</div>
            <div className="profile-stat-value">0</div>
            <div className="profile-stat-copy">Create a listing to get started</div>
          </div>
        ) : null}
      </section>

      <section className="yprofile-card">
        <div className="card-title">Reviews</div>
        <div className="card-copy">
          Reviews are loaded from the backend and tied to wallet addresses.
        </div>

        <div className="reviews-list">
          {reviews.length ? (
            reviews.map((review) => (
              <div className="review-item" key={review.id}>
                <div className="review-top">
                  <div>
                    <div className="reviewer mono">
                      {shortenAddress(review.reviewer_wallet)}
                    </div>
                    <div className="review-date">{review.created_at}</div>
                  </div>

                  <div className="review-rating">{renderStars(review.rating)}</div>
                </div>

                <p className="review-comment">{review.comment}</p>
              </div>
            ))
          ) : (
            <div className="empty">No reviews yet.</div>
          )}
        </div>
      </section>

      <section className="yprofile-card">
        <div className="card-title">Profile Status</div>
        <div className="card-copy">Current profile sync state.</div>
        <div className="status-box">{statusText}</div>
      </section>

      <style jsx>{`
        .yprofile {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
        }

        .yprofile-hero,
        .yprofile-card,
        .profile-stat-card {
          background: var(--panel);
          border: 1px solid var(--panelBorder);
          border-radius: 24px;
          padding: 28px;
          backdrop-filter: blur(18px);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
        }

        .yprofile-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
        }

        .yprofile-hero :global(.hero-title) {
          max-width: 760px;
        }

        .yprofile-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
          gap: 18px;
        }

        .profile-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
        }

        .profile-stat-card {
          display: block;
          min-height: 170px;
          transition: 0.15s ease;
        }

        .profile-stat-card.clickable {
          cursor: pointer;
        }

        .profile-stat-card.clickable:hover {
          transform: translateY(-2px);
          border-color: rgba(103, 183, 255, 0.28);
        }

        .profile-stat-label {
          color: var(--muted);
          font-size: 13px;
          margin-bottom: 12px;
        }

        .profile-stat-value {
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .profile-stat-copy {
          color: var(--muted);
          font-size: 13px;
          margin-top: 8px;
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--blue), var(--blue2));
          box-shadow: 0 12px 30px rgba(95, 115, 255, 0.28);
        }

        .profile-name {
          font-size: 24px;
          font-weight: 750;
          letter-spacing: -0.03em;
        }

        .profile-wallet {
          color: var(--muted);
          margin-top: 4px;
        }

        .profile-section {
          border-top: 1px solid var(--panelBorder);
          padding-top: 18px;
        }

        .profile-description-label {
          margin-top: 16px;
        }

        .profile-save-btn {
          width: 100%;
          margin-top: 16px;
        }

        .reputation-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .rating-number {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: -0.05em;
          margin-top: 16px;
        }

        .rating-stars,
        .review-rating {
          color: #facc15;
          letter-spacing: 0.08em;
        }

        .reviews-list {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .review-item {
          border: 1px solid var(--panelBorder);
          background: rgba(7, 15, 28, 0.58);
          border-radius: 18px;
          padding: 18px;
        }

        .review-top {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .reviewer {
          color: var(--text);
        }

        .review-date {
          color: var(--muted);
          font-size: 13px;
          margin-top: 4px;
        }

        .review-comment {
          margin: 14px 0 0;
          color: var(--muted);
          line-height: 1.55;
        }

        @media (max-width: 900px) {
          .yprofile-hero {
            flex-direction: column;
          }

          .yprofile-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function renderStars(rating: number) {
  const rounded = Math.round(rating);

  return "★★★★★"
    .split("")
    .map((star, index) => (index < rounded ? star : "☆"))
    .join("");
}