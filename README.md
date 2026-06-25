Yoda Market

This is a full-stack Dapp built on the Ethereum Sepolia testnet. 
Yoda Market lets users create item-sale listings or task-based bounties, request participation, approve counterparties, lock ERC-20 payments in escrow, and build wallet-based reputation through reviews.

Overview

Yoda Market is a Web3 marketplace designed around secure peer-to-peer transactions for gaming-related digital services, items, achievements, boosting, and task completion.

The application supports two transaction flows:

* Item Sales — sellers list a digital item or service, approve a buyer, and receive payment after delivery is confirmed.
* Bounties — creators post a task with a YODA token reward, approve a worker, and release payment after the work is submitted and accepted.

The project combines on-chain smart contracts for payment security with an off-chain backend for user profiles and reviews.

Key Features

* Wallet-based authentication through MetaMask
* Ethereum Sepolia testnet deployment
* ERC-20 YODA token used as marketplace currency
* Marketplace contract for listing creation, requester tracking, and approval logic
* Escrow contract for locked payments, submission, rejection, release, and refund flows
* Item-sale and bounty transaction models
* Seller/creator approval system instead of first-come-first-served purchasing
* One-time rejection flow with required rejection reason
* Platform fee support through escrow payout logic
* Off-chain profile and review system using Express and SQLite
* Review duplication prevention and self-review prevention
* Next.js frontend with marketplace, dashboard, and profile pages

Tech Stack

Frontend

* Next.js
* React
* TypeScript
* Ethers.js
* Tailwind CSS
* MetaMask wallet integration

Smart Contracts

* Solidity
* Hardhat
* Ethereum Sepolia testnet
* ERC-20 token contract
* Marketplace contract
* Escrow contract

Backend

* Node.js
* Express
* TypeScript
* SQLite
* better-sqlite3

Architecture

Yoda Market uses a hybrid Web3 architecture.

User / MetaMask
      |
      v
Next.js Frontend
      |
      |---- Ethers.js ----> Marketplace Contract
      |---- Ethers.js ----> Escrow Contract
      |---- Ethers.js ----> YODA ERC-20 Token
      |
      |---- REST API ----> Express Backend
                            |
                            v
                         SQLite DB

The blockchain layer handles listing state, approvals, escrow funding, submission, confirmation, refunds, and payout logic. The backend handles user profile data and reputation because this information does not need to be stored on-chain.

Transaction Flow

Item Sale

1. Seller creates an item listing.
2. Buyers request the listing.
3. Seller approves one requester.
4. Approved buyer approves YODA token spending.
5. Buyer funds escrow.
6. Seller submits delivery.
7. Buyer confirms or rejects delivery.
8. On confirmation, escrow releases payment to the seller.

Bounty

1. Creator posts a bounty with a reward amount.
2. Workers apply for the bounty.
3. Creator approves one worker.
4. Creator approves YODA token spending for the reward.
5. Approved worker activates escrow.
6. Worker submits completed work.
7. Creator confirms or rejects the submission.
8. On confirmation, escrow releases payment to the worker.

Smart Contract Design

Marketplace Contract

The marketplace contract manages:

* Listing creation
* Listing metadata
* Listing type: item sale or bounty
* Listing status
* Requester lists
* Approved requester tracking
* Seller-created listings
* Buyer/worker-associated listings

Only the escrow contract can move listings into reserved, completed, sold, or cancelled escrow-controlled states. This prevents users from bypassing the payment flow.

Escrow Contract

The escrow contract manages:

* ERC-20 token transfer into escrow
* Item-sale payment locking
* Bounty reward locking
* Work submission
* One-time rejection
* Payment release
* Refunds
* Platform fees

The escrow contract uses different payout logic depending on the listing type. For item sales, the seller receives payment. For bounties, the worker receives payment.

Backend Design

The backend provides REST APIs for off-chain identity and reputation.

Profiles

* Profiles are tied to wallet addresses.
* A profile is automatically created when a wallet is first loaded.
* Users can update their display name and description.

Reviews

* Users can leave ratings and comments for completed interactions.
* Users cannot review themselves.
* Duplicate reviews for the same listing interaction are blocked.

Pages

Marketplace

Displays public listings and lets users request items, apply for bounties, or fund approved listings.

Dashboard

Lets users create listings, view their own listings, approve requesters, fund escrow, submit work, reject work, confirm completion, and leave reviews.

Profile

Shows wallet-based identity, reputation score, received reviews, and user activity statistics.

Security and Trust Design

Yoda Market reduces scam risk through several mechanisms:

* Funds are locked before delivery.
* Sellers cannot receive payment until the buyer confirms delivery.
* Workers must be approved before bounty work begins.
* Bounty creators must approve token spending before escrow can be activated.
* Only one requester can be approved for a listing.
* Users can reject submitted work only once.
* Reviews help users evaluate counterparties before approving transactions.

Performance Notes

During manual testing on Sepolia:

* Typical transaction confirmation time was approximately 10–25 seconds.
* Escrow operations were more expensive than read-only or listing-management operations because they update multiple pieces of contract state.
* The system prioritizes correctness and transaction safety over gas minimization.

Challenges

Some of the main implementation challenges included:

* Handling MetaMask connection and chain detection
* Keeping deployed contract addresses synchronized across frontend environment variables
* Implementing ERC-20 allowance and approval flows
* Designing separate escrow behavior for item sales and bounties
* Preventing duplicate reviews
* Coordinating on-chain transaction state with off-chain profile and review data

Future Improvements

* In-app messaging
* Dispute arbitration
* NFT-based item ownership
* Search and filtering
* Admin analytics dashboard
* Event-based indexing instead of scanning listing IDs
* Expanded automated smart contract tests
* Production deployment with persistent hosted database

AI Usage Disclosure

AI assistance was used for frontend and backend debugging. The smart contracts were written without AI-generated contract logic.

Project Status

This project is a functional prototype deployed for demonstration and educational purposes. It is not intended for production use with real financial value without additional security review, automated test coverage, and contract auditing.