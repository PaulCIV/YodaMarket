# YodaMarket

![Solidity](https://img.shields.io/badge/Solidity-Smart%20Contracts-363636)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-627EEA)
![React](https://img.shields.io/badge/React-Frontend-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933)
![Express](https://img.shields.io/badge/Express-API-000000)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57)
![Web3](https://img.shields.io/badge/Web3-dApp-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

A full-stack decentralized marketplace built on Ethereum Sepolia. YodaMarket allows users to create sale listings or task-based bounties, request participation, approve counterparties, lock ERC-20 payments in escrow, and build wallet-based reputation through reviews.

# Overview

Yoda Market is a Web3 marketplace designed around secure peer-to-peer transactions for gaming-related digital services, digital items, achievements, boosting, and task completion.

The application supports two transaction methods:

- **Item Sales** — sellers list an item or service, approve a buyer, and receive payment after delivery is confirmed.
- **Bounties** — creators post a task with a YODA token reward, approve a worker, and release payment after submitted work is accepted.

The project combines on-chain smart contracts for payment security with an off-chain backend for user profiles and reviews. The goal was to model a decentralized marketplace where wallets provide identity, escrow reduces fraud risk, and reputation helps users evaluate counterparties before transacting.

# Features

## Wallet-Based Identity

- MetaMask wallet connection
- Wallet-based user identity
- Sepolia testnet support
- Automatic profile creation on first load
- Profile customization through backend API

## Marketplace Listings

- Create item-sale listings
- Create bounty listings
- Browse active listings
- Request item purchases
- Apply for bounties
- View listing status and participants
- Approve one requester per listing

## Escrow System

- ERC-20 YODA token escrow
- Buyer-funded item-sale transactions
- Creator-funded bounty rewards
- Smart-contract-controlled payment release
- Refund handling
- One-time rejection flow with required rejection reason

## Reputation System

- Wallet-based user profiles
- Ratings and written reviews
- Duplicate review prevention
- Self-review prevention
- Off-chain review storage using SQLite

## Dashboard

- Create listings
- Approve requesters
- Fund escrow
- Submit work or delivery
- Confirm completed work
- Reject submitted work once
- Leave reviews
- Manage profile information

# Technology Stack

## Frontend

- React
- JavaScript
- Ethers.js
- MetaMask integration
- Vercel deployment

## Smart Contracts

- Solidity
- Hardhat
- Ethereum Sepolia testnet
- ERC-20 token contract
- Marketplace contract
- Escrow contract

## Backend

- Node.js
- Express
- SQLite
- REST-style API architecture

## Development

- Git
- Smart contract deployment scripts
- Environment-based contract configuration
- Manual end-to-end testing

# Architecture

Yoda Market uses a hybrid Web3 architecture. Smart contracts handle payment-critical marketplace logic, while the backend stores non-critical profile and review data.

                    React Frontend
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   Marketplace Contract  Escrow Contract  YODA Token
          │                │                │
          └────────────┬───┴────────────────┘
                       │
                 Ethereum Sepolia
                       
                    React Frontend
                           │
                           ▼
                    Express Backend
                           │
                           ▼
                      SQLite Database

      • Profiles
      • Reviews
      • Wallet metadata

The blockchain layer manages listing state, approvals, escrow funding, submission, confirmation, rejection, refunds, and payout logic. The backend manages user-facing identity and reputation data that does not need to be stored on-chain.

# Transaction Flows

## Item Sale Flow

Seller creates listing
        │
Buyers request listing
        │
Seller approves one buyer
        │
Buyer approves YODA spending
        │
Buyer funds escrow
        │
Seller submits delivery
        │
Buyer confirms or rejects
        │
Escrow releases payment or returns to reserved state

## Bounty Flow

Creator posts bounty
        │
Workers apply
        │
Creator approves one worker
        │
Creator approves YODA spending
        │
Escrow locks bounty reward
        │
Worker submits completed work
        │
Creator confirms or rejects
        │
Escrow releases payment or returns to reserved state

# Smart Contract Design

## Marketplace Contract

- Listing creation
- Listing metadata
- Listing type: item sale or bounty
- Listing status
- Requester tracking
- Approved requester tracking
- Seller-created listings
- Buyer and worker-associated listings

Only the escrow contract can move listings through escrow-controlled status transitions. This prevents users from bypassing payment and completion logic.

## Escrow Contract

- ERC-20 token transfer into escrow
- Item-sale payment locking
- Bounty reward locking
- Work submission
- One-time rejection
- Payment release
- Refunds
- Platform fee handling

The escrow contract uses different funding and payout logic depending on whether the listing is an item sale or bounty.

# Security and Trust Design

- Funds are locked before delivery.
- Sellers cannot receive payment until delivery is confirmed.
- Workers must be approved before bounty work begins.
- Creators must approve token spending before bounty escrow is activated.
- Only one requester can be approved per listing.
- Submitted work can only be rejected once.
- Reviews help users evaluate counterparties before approving transactions.

# Performance Notes

- Typical transaction confirmation time was approximately 10–25 seconds.
- Escrow operations required more gas than read-only or listing-management operations because they update multiple pieces of contract state.
- The system prioritizes correctness, payment safety, and clear state transitions over aggressive gas optimization.

# Challenges

- Handling MetaMask connection and chain detection
- Keeping deployed contract addresses synchronized through environment variables
- Implementing ERC-20 allowance and approval flows
- Designing separate escrow behavior for item sales and bounties
- Coordinating on-chain listing state with off-chain profile and review data
- Preventing duplicate reviews through database constraints
- Handling transaction state changes across the frontend, backend, and blockchain

# Future Improvements

Potential future enhancements include:

- In-app messaging
- Dispute arbitration
- NFT-based item ownership
- Advanced search and filtering
- Analytics dashboard
- Event-based indexing instead of listing scans
- Expanded automated smart contract tests
- Contract security audit
- Production deployment with persistent hosted database

# AI Usage Disclosure

AI assistance was used for frontend and backend debugging. The smart contracts were written without AI-generated contract logic.

# Project Status

Completed as a functional Web3 prototype demonstrating smart-contract escrow, ERC-20 payments, wallet-based identity, decentralized marketplace flows, and off-chain reputation tracking.

As of currently this project is not intended for production use with real financial value without additional security review, automated testing, and contract auditing.
