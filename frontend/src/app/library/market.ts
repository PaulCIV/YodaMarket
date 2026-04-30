import { addresses, getReadContracts } from "./contracts";

export type ListingData = {
  id: number;
  seller: string;
  buyer: string;
  buyerZero: boolean;
  priceRaw: bigint;
  metadataURI: string;
  listingType: number;
  status: number;
  exists: boolean;
  isFundable: boolean;
  requesters: string[];
  approvedBuyer: string;
  approvedBuyerZero: boolean;
};

export type EscrowData = {
  listingId: number;
  buyer: string;
  seller: string;
  amountRaw: bigint;
  status: number;
  fundedAt: bigint;
  exists: boolean;
  rejectedOnce: boolean;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function normalizeListing(raw: any, marketplace?: any, token?: any): Promise<ListingData> {
  const buyer = raw.buyer ?? raw[2];
  const listingId = Number(raw.id ?? raw[0]);

  const listing: ListingData = {
    id: listingId,
    seller: raw.seller ?? raw[1],
    buyer,
    buyerZero: buyer.toLowerCase() === ZERO_ADDRESS.toLowerCase(),
    priceRaw: raw.price ?? raw[3],
    metadataURI: raw.metadataURI ?? raw[4],
    listingType: Number(raw.listingType ?? raw[5]),
    status: Number(raw.status ?? raw[6]),
    exists: Boolean(raw.exists ?? raw[7]),
    isFundable: true,
    requesters: [],
    approvedBuyer: ZERO_ADDRESS,
    approvedBuyerZero: true,
  };

  if (marketplace) {
    try {
      const requesters = (await marketplace.getListingRequesters(
        BigInt(listing.id)
      )) as string[];
      listing.requesters = requesters;
    } catch {
      listing.requesters = [];
    }

    try {
      const approvedBuyer = await marketplace.approvedBuyer(BigInt(listing.id));
      listing.approvedBuyer = approvedBuyer;
      listing.approvedBuyerZero =
        approvedBuyer.toLowerCase() === ZERO_ADDRESS.toLowerCase();
    } catch {
      listing.approvedBuyer = ZERO_ADDRESS;
      listing.approvedBuyerZero = true;
    }
  }

  if (listing.listingType === 1 && listing.status === 1 && token) {
    try {
      const allowance = await token.allowance(listing.seller, addresses.escrow);
      listing.isFundable = allowance >= listing.priceRaw;
    } catch {
      listing.isFundable = false;
    }
  }

  return listing;
}

function normalizeEscrow(raw: any): EscrowData {
  return {
    listingId: Number(raw.listingId ?? raw[0]),
    buyer: raw.buyer ?? raw[1],
    seller: raw.seller ?? raw[2],
    amountRaw: raw.amount ?? raw[3],
    status: Number(raw.status ?? raw[4]),
    fundedAt: raw.fundedAt ?? raw[5],
    exists: Boolean(raw.exists ?? raw[6]),
    rejectedOnce: Boolean(raw.rejectedOnce ?? raw[7]),
  };
}

export async function fetchAllListings() {
  const { marketplace, token } = await getReadContracts();
  const nextId = Number(await marketplace.getNextListingId());

  if (nextId <= 1) return [];

  const promises = [];

  for (let i = 1; i < nextId; i++) {
    promises.push(
      marketplace
        .getListing(BigInt(i))
        .then((result: any) => normalizeListing(result, marketplace, token))
        .catch(() => null)
    );
  }

  const results = await Promise.all(promises);

  return results.filter(Boolean) as ListingData[];
}

export async function fetchListingsByIds(ids: Array<number | bigint>) {
  const { marketplace, token } = await getReadContracts();

  const results = await Promise.all(
    ids.map((id) =>
      marketplace
        .getListing(BigInt(id))
        .then((result: any) => normalizeListing(result, marketplace, token))
        .catch(() => null)
    )
  );

  return results.filter(Boolean) as ListingData[];
}

export async function fetchUserListingSets(address: string) {
  const { marketplace } = await getReadContracts();

  const sellerIdsRaw = (await marketplace.getSellerListingIds(address)) as bigint[];
  const buyerIdsRaw = (await marketplace.getBuyerListingIds(address)) as bigint[];

  const sellerListings = await fetchListingsByIds(sellerIdsRaw);
  const buyerListings = await fetchListingsByIds(buyerIdsRaw);

  return {
    sellerListings,
    buyerListings,
  };
}

export async function fetchEscrowByListingId(listingId: number) {
  const { escrow } = await getReadContracts();

  try {
    const raw = await escrow.getEscrow(BigInt(listingId));
    const normalized = normalizeEscrow(raw);

    return normalized.exists ? normalized : null;
  } catch {
    return null;
  }
}