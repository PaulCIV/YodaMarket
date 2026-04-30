import { Router } from "express";
import db from "../db";

const router = Router();

router.get("/:wallet", (req, res) => {
  const wallet = req.params.wallet.toLowerCase();

  const reviews = db
    .prepare(
      "SELECT * FROM reviews WHERE LOWER(reviewed_wallet) = ? ORDER BY created_at DESC"
    )
    .all(wallet);

  res.json(reviews);
});

router.post("/", (req, res) => {
  const { reviewer_wallet, reviewed_wallet, listing_id, rating, comment } =
    req.body;

  if (!reviewer_wallet || !reviewed_wallet || !listing_id || !rating) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const numericRating = Number(rating);
  const numericListingId = Number(listing_id);

  if (numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5." });
  }

  if (reviewer_wallet.toLowerCase() === reviewed_wallet.toLowerCase()) {
    return res.status(400).json({ error: "You cannot review yourself." });
  }

  const existingReview = db
    .prepare(
      `
      SELECT id FROM reviews
      WHERE LOWER(reviewer_wallet) = ?
      AND listing_id = ?
    `
    )
    .get(reviewer_wallet.toLowerCase(), numericListingId);

  if (existingReview) {
    return res.status(409).json({
      error: "You already reviewed this deal.",
    });
  }

  try {
    const result = db
      .prepare(
        `
        INSERT INTO reviews (
          reviewer_wallet,
          reviewed_wallet,
          listing_id,
          rating,
          comment
        )
        VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(
        reviewer_wallet.toLowerCase(),
        reviewed_wallet.toLowerCase(),
        numericListingId,
        numericRating,
        comment || ""
      );

    const review = db
      .prepare("SELECT * FROM reviews WHERE id = ?")
      .get(result.lastInsertRowid);

    res.json(review);
  } catch {
    res.status(409).json({ error: "You already reviewed this deal." });
  }
});

export default router;