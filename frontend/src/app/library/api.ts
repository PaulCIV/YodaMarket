const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001";

export type UserProfile = {
  id?: number;
  wallet_address: string;
  display_name: string;
  description: string;
  created_at?: string;
};

export type Review = {
  id: number;
  reviewer_wallet: string;
  reviewed_wallet: string;
  listing_id: number | null;
  rating: number;
  comment: string;
  created_at: string;
};

export async function getProfile(walletAddress: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/profile/${walletAddress}`);

  if (!res.ok) {
    throw new Error("Could not load profile.");
  }

  return res.json();
}

export async function updateProfile(
  walletAddress: string,
  displayName: string,
  description: string
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wallet_address: walletAddress,
      display_name: displayName,
      description,
    }),
  });

  if (!res.ok) {
    throw new Error("Could not update profile.");
  }

  const data = await res.json();

  if (data?.wallet_address && data?.display_name !== undefined) {
    return data;
  }

  return getProfile(walletAddress);
}

export async function getReviews(walletAddress: string): Promise<Review[]> {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${walletAddress}`);

  if (!res.ok) {
    throw new Error("Could not load reviews.");
  }

  return res.json();
}

export async function createReview({
  reviewerWallet,
  reviewedWallet,
  listingId,
  rating,
  comment,
}: {
  reviewerWallet: string;
  reviewedWallet: string;
  listingId: number;
  rating: number;
  comment: string;
}): Promise<Review> {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reviewer_wallet: reviewerWallet,
      reviewed_wallet: reviewedWallet,
      listing_id: listingId,
      rating,
      comment,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Could not create review.");
  }

  return res.json();
}