import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as string;
const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as string;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as string;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);

export const WALLET_MISSING_MESSAGE =
  "MetaMask was not detected. Use Chrome or Brave with the MetaMask extension installed.";

export function getEthereumProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  if (window.ethereum.providers?.length) {
    const metamaskProvider = window.ethereum.providers.find(
      (provider: any) => provider.isMetaMask
    );

    return metamaskProvider || window.ethereum.providers[0];
  }

  return window.ethereum;
}

export function hasInjectedWallet() {
  return Boolean(getEthereumProvider());
}

export async function switchToExpectedChain() {
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new Error(WALLET_MISSING_MESSAGE);
  }

  const expectedChainHex = `0x${CHAIN_ID.toString(16)}`;

  await ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: expectedChainHex }],
  });
}

export const marketplaceAbi = [
  "function createListing(uint256 price, string metadataURI, uint8 listingType) external",
  "function updateListing(uint256 listingId, uint256 newPrice, string newMetadataURI) external",
  "function cancelActiveListing(uint256 listingId) external",
  "function requestListing(uint256 listingId) external",
  "function approveRequester(uint256 listingId, address requester) external",
  "function getListingRequesters(uint256 listingId) external view returns (address[] memory)",
  "function approvedBuyer(uint256 listingId) external view returns (address)",
  "function getListing(uint256 listingId) external view returns (tuple(uint256 id, address seller, address buyer, uint256 price, string metadataURI, uint8 listingType, uint8 status, bool exists))",
  "function getNextListingId() external view returns (uint256)",
  "function getTotalListings() external view returns (uint256)",
  "function getSellerListingIds(address seller) external view returns (uint256[] memory)",
  "function getBuyerListingIds(address buyer) external view returns (uint256[] memory)",

  "event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 price, string metadataURI, uint8 listingType)",
  "event ListingUpdated(uint256 indexed listingId, uint256 newPrice, string newMetadataURI)",
  "event ListingStatusChanged(uint256 indexed listingId, uint8 newStatus)",
  "event BuyerAssigned(uint256 indexed listingId, address indexed buyer)",
  "event ListingRequested(uint256 indexed listingId, address indexed requester)",
  "event RequesterApproved(uint256 indexed listingId, address indexed requester)",
  "event EscrowContractSet(address indexed escrowContract)",
];

export const escrowAbi = [
  "function fundEscrow(uint256 listingId) external",
  "function submitWork(uint256 listingId) external",
  "function rejectWork(uint256 listingId, string reason) external",
  "function confirmCompletion(uint256 listingId) external",
  "function sellerCancel(uint256 listingId) external",
  "function adminRefund(uint256 listingId) external",
  "function getEscrow(uint256 listingId) external view returns (tuple(uint256 listingId, address buyer, address seller, uint256 amount, uint8 status, uint256 fundedAt, bool exists, bool rejectedOnce))",
  "function platformFeeBps() external view returns (uint256)",
  "function feeRecipient() external view returns (address)",
  "function paymentToken() external view returns (address)",
  "function marketplace() external view returns (address)",

  "event EscrowFunded(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 amount)",
  "event WorkSubmitted(uint256 indexed listingId, address indexed submittedBy)",
  "event WorkRejected(uint256 indexed listingId, address indexed rejectedBy, string reason)",
  "event EscrowReleased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 payoutAmount, uint256 feeAmount)",
  "event EscrowRefunded(uint256 indexed listingId, address indexed refundRecipient, uint256 amount)",
  "event EscrowCancelled(uint256 indexed listingId)",
];

export const tokenAbi = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function receiveTokens() external",
];

export type ListingTypeLabel = "Item Sale" | "Bounty";

export const listingTypeMap: Record<number, ListingTypeLabel> = {
  0: "Item Sale",
  1: "Bounty",
};

export type ListingStatusLabel =
  | "None"
  | "Active"
  | "Reserved"
  | "Completed"
  | "Sold"
  | "Cancelled";

export const listingStatusMap: Record<number, ListingStatusLabel> = {
  0: "None",
  1: "Active",
  2: "Reserved",
  3: "Completed",
  4: "Sold",
  5: "Cancelled",
};

export const escrowStatusMap: Record<number, string> = {
  0: "None",
  1: "Funded",
  2: "Submitted",
  3: "Released",
  4: "Refunded",
  5: "Cancelled",
};

export async function getProvider() {
  const ethereumProvider = getEthereumProvider();

  if (!ethereumProvider) {
    throw new Error(WALLET_MISSING_MESSAGE);
  }

  return new BrowserProvider(ethereumProvider);
}

export async function connectWallet() {
  const ethereumProvider = getEthereumProvider();

  if (!ethereumProvider) {
    throw new Error(WALLET_MISSING_MESSAGE);
  }

  const provider = new BrowserProvider(ethereumProvider);

  await ethereumProvider.request({ method: "eth_requestAccounts" });

  const network = await provider.getNetwork();
  const numericChainId = Number(network.chainId);

  if (numericChainId !== CHAIN_ID) {
    await switchToExpectedChain();

    const refreshedProvider = new BrowserProvider(ethereumProvider);
    const refreshedSigner = await refreshedProvider.getSigner();
    const refreshedNetwork = await refreshedProvider.getNetwork();
    const refreshedChainId = Number(refreshedNetwork.chainId);

    return {
      provider: refreshedProvider,
      signer: refreshedSigner,
      address: await refreshedSigner.getAddress(),
      chainId: refreshedChainId,
      isCorrectChain: refreshedChainId === CHAIN_ID,
    };
  }

  const signer = await provider.getSigner();

  return {
    provider,
    signer,
    address: await signer.getAddress(),
    chainId: numericChainId,
    isCorrectChain: numericChainId === CHAIN_ID,
  };
}

export async function getReadContracts() {
  const provider = await getProvider();

  const marketplace = new Contract(MARKETPLACE_ADDRESS, marketplaceAbi, provider);
  const escrow = new Contract(ESCROW_ADDRESS, escrowAbi, provider);
  const token = new Contract(TOKEN_ADDRESS, tokenAbi, provider);

  return { provider, marketplace, escrow, token };
}

export async function getWriteContracts() {
  const { provider, signer } = await connectWallet();

  const marketplace = new Contract(MARKETPLACE_ADDRESS, marketplaceAbi, signer);
  const escrow = new Contract(ESCROW_ADDRESS, escrowAbi, signer);
  const token = new Contract(TOKEN_ADDRESS, tokenAbi, signer);

  return { provider, signer, marketplace, escrow, token };
}

export async function toTokenAmount(value: string) {
  const { token } = await getReadContracts();
  const decimals = await token.decimals();

  return parseUnits(value, decimals);
}

export async function fromTokenAmount(value: bigint) {
  const { token } = await getReadContracts();
  const decimals = await token.decimals();

  return formatUnits(value, decimals);
}

export function toTokenAmountWithDecimals(value: string, decimals: number) {
  return parseUnits(value, decimals);
}

export function fromTokenAmountWithDecimals(value: bigint, decimals: number) {
  return formatUnits(value, decimals);
}

export function shortenAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const addresses = {
  marketplace: MARKETPLACE_ADDRESS,
  escrow: ESCROW_ADDRESS,
  token: TOKEN_ADDRESS,
};

export const expectedChainId = CHAIN_ID;