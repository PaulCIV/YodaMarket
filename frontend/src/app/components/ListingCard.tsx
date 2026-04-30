"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fromTokenAmount,
  listingStatusMap,
  listingTypeMap,
  shortenAddress,
} from "../library/contracts";
import type { ListingData } from "../library/market";

type ListingCardProps = {
  listing: ListingData;
  actionLabel?: string;
  onAction?: (listingId: number) => void | Promise<void>;
  secondaryActionLabel?: string;
  onSecondaryAction?: (listingId: number) => void | Promise<void>;
  actionDisabled?: boolean;
  actionStatus?: string;
  showRequesters?: boolean;
  requesterActionLabel?: string;
  onRequesterAction?: (listingId: number, requester: string) => void | Promise<void>;
};

export default function ListingCard({
  listing,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  actionDisabled = false,
  actionStatus = "",
  showRequesters = false,
  requesterActionLabel = "Approve",
  onRequesterAction,
}: ListingCardProps) {
  const [price, setPrice] = useState("");

  const metadata = useMemo(
    () => parseListingMetadata(listing.metadataURI),
    [listing.metadataURI]
  );

  const amountLabel = listing.listingType === 1 ? "Reward" : "Price";

  useEffect(() => {
    async function loadPrice() {
      const formatted = await fromTokenAmount(listing.priceRaw);
      setPrice(formatted);
    }

    loadPrice();
  }, [listing.priceRaw]);

  return (
    <article className="listing-card clean-card">
      <div className="listing-card-head">
        <div>
          <div className="listing-card-id">Listing #{listing.id}</div>
          <h3 className="listing-title">{metadata.title}</h3>
          <p className="listing-description">{metadata.description}</p>
        </div>

        <span className={`badge ${getBadgeClass(listing.status)}`}>
          {listingStatusMap[listing.status] ?? "Unknown"}
        </span>
      </div>

      <div className="listing-price-row">
        <div className="listing-price">{price || "..."} YODA</div>
        <div className="listing-amount-label">{amountLabel}</div>
      </div>

      <div className="listing-meta-grid">
        <div className="listing-meta-block">
          <div className="listing-meta-label">Type</div>
          <div className="listing-meta-value">
            {listingTypeMap[listing.listingType] ?? "Unknown"}
          </div>
        </div>

        <div className="listing-meta-block">
          <div className="listing-meta-label">
            {listing.listingType === 1 ? "Creator" : "Seller"}
          </div>
          <div className="listing-meta-value mono">
            {shortenAddress(listing.seller)}
          </div>
        </div>

        <div className="listing-meta-block">
          <div className="listing-meta-label">
            {listing.listingType === 1 ? "Worker" : "Buyer"}
          </div>
          <div className="listing-meta-value mono">
            {listing.buyerZero ? "Unassigned" : shortenAddress(listing.buyer)}
          </div>
        </div>
      </div>

      {!listing.approvedBuyerZero && listing.status === 1 ? (
        <div className="listing-small-note">
          Approved requester:{" "}
          <span className="mono">{shortenAddress(listing.approvedBuyer)}</span>
        </div>
      ) : null}

      {showRequesters && listing.status === 1 ? (
        <div className="requesters-box">
          <div className="requesters-title">Requests</div>

          {listing.requesters.length ? (
            <div className="requesters-list">
              {listing.requesters.map((requester) => {
                const isApproved =
                  requester.toLowerCase() === listing.approvedBuyer.toLowerCase();

                return (
                  <div className="requester-row" key={requester}>
                    <span className="mono">{shortenAddress(requester)}</span>

                    {isApproved ? (
                      <span className="approved-pill">Approved</span>
                    ) : onRequesterAction ? (
                      <button
                        className="mini-btn"
                        onClick={() => onRequesterAction(listing.id, requester)}
                        disabled={actionDisabled}
                      >
                        {requesterActionLabel}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="requesters-empty">No requests yet.</div>
          )}
        </div>
      ) : null}

      {actionStatus ? (
        <div className="listing-card-status">{actionStatus}</div>
      ) : null}

      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="listing-actions">
          {actionLabel && onAction ? (
            <button
              className="btn btn-primary"
              onClick={() => onAction(listing.id)}
              disabled={actionDisabled}
            >
              {actionDisabled ? "Working..." : actionLabel}
            </button>
          ) : null}

          {secondaryActionLabel && onSecondaryAction ? (
            <button
              className="btn btn-secondary"
              onClick={() => onSecondaryAction(listing.id)}
              disabled={actionDisabled}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <style jsx>{`
        .listing-amount-label,
        .listing-small-note {
          color: var(--muted);
          font-size: 13px;
          margin-top: 4px;
        }

        .listing-card-status,
        .requesters-box {
          border: 1px solid var(--panelBorder);
          background: rgba(7, 15, 28, 0.72);
          border-radius: 14px;
          padding: 10px 12px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.4;
        }

        .requesters-title {
          color: var(--text);
          font-weight: 700;
          margin-bottom: 8px;
        }

        .requesters-list {
          display: grid;
          gap: 8px;
        }

        .requester-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .requesters-empty {
          color: var(--muted);
        }

        .mini-btn {
          border: 1px solid var(--panelBorder);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          border-radius: 10px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 12px;
        }

        .mini-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .approved-pill {
          border: 1px solid rgba(90, 255, 170, 0.25);
          color: #8fffc1;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
        }

        .listing-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
      `}</style>
    </article>
  );
}

function parseListingMetadata(metadataURI: string) {
  try {
    const parsed = JSON.parse(metadataURI);

    return {
      title: parsed.title || "Untitled Listing",
      description: parsed.description || "No description provided.",
    };
  } catch {
    return {
      title: metadataURI || "Untitled Listing",
      description: "No description provided.",
    };
  }
}

function getBadgeClass(status: number) {
  if (status === 1) return "badge-active";
  if (status === 2) return "badge-reserved";
  if (status === 3) return "badge-completed";
  if (status === 4) return "badge-sold";
  return "badge-cancelled";
}