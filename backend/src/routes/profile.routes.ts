import { Router } from "express";
import db from "../db";

const router = Router();

// GET PROFILE
// Auto-creates a profile if the wallet has never been seen before.
router.get("/:wallet", (req, res) => {
  const { wallet } = req.params;

  let user = db
    .prepare("SELECT * FROM users WHERE wallet_address = ?")
    .get(wallet);

  if (!user) {
    db.prepare(`
      INSERT INTO users (wallet_address, display_name, description)
      VALUES (?, ?, ?)
    `).run(
      wallet,
      "Unnamed Player",
      "No profile description added yet."
    );

    user = db
      .prepare("SELECT * FROM users WHERE wallet_address = ?")
      .get(wallet);
  }

  res.json(user);
});

// CREATE / UPDATE PROFILE
router.post("/", (req, res) => {
  const { wallet_address, display_name, description } = req.body;

  if (!wallet_address) {
    return res.status(400).json({ error: "wallet_address required" });
  }

  db.prepare(`
    INSERT INTO users (wallet_address, display_name, description)
    VALUES (?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      display_name = excluded.display_name,
      description = excluded.description
  `).run(
    wallet_address,
    display_name || "Unnamed Player",
    description || "No profile description added yet."
  );

  const user = db
    .prepare("SELECT * FROM users WHERE wallet_address = ?")
    .get(wallet_address);

  res.json(user);
});

export default router;