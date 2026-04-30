// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

interface IMarketplace {
    enum ListingType {
        ItemSale,
        Bounty
    }

    enum ListingStatus {
        None,
        Active,
        Reserved,
        Completed,
        Sold,
        Cancelled
    }

    struct Listing {
        uint256 id;
        address seller;
        address buyer;
        uint256 price;
        string metadataURI;
        ListingType listingType;
        ListingStatus status;
        bool exists;
    }

    function getListing(uint256 listingId) external view returns (Listing memory);

    function approvedBuyer(uint256 listingId) external view returns (address);

    function escrowReserveListing(uint256 listingId, address buyer) external;

    function escrowMarkCompleted(uint256 listingId) external;

    function escrowMarkReserved(uint256 listingId) external;

    function escrowMarkAsSold(uint256 listingId) external;

    function escrowCancelReservedListing(uint256 listingId) external;
}

contract Escrow {
    enum EscrowStatus {
        None,
        Funded,
        Submitted,
        Released,
        Refunded,
        Cancelled
    }

    struct EscrowDeal {
        uint256 listingId;
        address buyer;
        address seller;
        uint256 amount;
        EscrowStatus status;
        uint256 fundedAt;
        bool exists;
        bool rejectedOnce;
    }

    address public owner;
    address public marketplace;
    IERC20 public paymentToken;

    uint256 public platformFeeBps = 250;
    address public feeRecipient;

    mapping(uint256 => EscrowDeal) public escrows;

    event EscrowFunded(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount
    );

    event WorkSubmitted(uint256 indexed listingId, address indexed submittedBy);

    event WorkRejected(
        uint256 indexed listingId,
        address indexed rejectedBy,
        string reason
    );

    event EscrowReleased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 payoutAmount,
        uint256 feeAmount
    );

    event EscrowRefunded(
        uint256 indexed listingId,
        address indexed refundRecipient,
        uint256 amount
    );

    event EscrowCancelled(uint256 indexed listingId);

    event PlatformFeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newFeeRecipient);
    event PaymentTokenUpdated(address newPaymentToken);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlySeller(uint256 listingId) {
        require(escrows[listingId].seller == msg.sender, "Not seller");
        _;
    }

    modifier escrowExists(uint256 listingId) {
        require(escrows[listingId].exists, "Escrow does not exist");
        _;
    }

    constructor(
        address _marketplace,
        address _paymentToken,
        address _feeRecipient
    ) {
        require(_marketplace != address(0), "Invalid marketplace");
        require(_paymentToken != address(0), "Invalid token");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        owner = msg.sender;
        marketplace = _marketplace;
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }

    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");

        platformFeeBps = newFeeBps;

        emit PlatformFeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid fee recipient");

        feeRecipient = newFeeRecipient;

        emit FeeRecipientUpdated(newFeeRecipient);
    }

    function setPaymentToken(address newPaymentToken) external onlyOwner {
        require(newPaymentToken != address(0), "Invalid token");

        paymentToken = IERC20(newPaymentToken);

        emit PaymentTokenUpdated(newPaymentToken);
    }

    function fundEscrow(uint256 listingId) external {
        IMarketplace.Listing memory listing =
            IMarketplace(marketplace).getListing(listingId);

        require(listing.exists, "Listing does not exist");
        require(
            listing.status == IMarketplace.ListingStatus.Active,
            "Listing not active"
        );
        require(msg.sender != listing.seller, "Creator cannot accept own listing");
        require(!escrows[listingId].exists, "Escrow already exists");
        require(
            IMarketplace(marketplace).approvedBuyer(listingId) == msg.sender,
            "Not approved for listing"
        );

        bool success;

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            success = paymentToken.transferFrom(
                msg.sender,
                address(this),
                listing.price
            );
        } else {
            success = paymentToken.transferFrom(
                listing.seller,
                address(this),
                listing.price
            );
        }

        require(success, "Token transfer failed");

        escrows[listingId] = EscrowDeal({
            listingId: listingId,
            buyer: msg.sender,
            seller: listing.seller,
            amount: listing.price,
            status: EscrowStatus.Funded,
            fundedAt: block.timestamp,
            exists: true,
            rejectedOnce: false
        });

        IMarketplace(marketplace).escrowReserveListing(listingId, msg.sender);

        emit EscrowFunded(
            listingId,
            msg.sender,
            listing.seller,
            listing.price
        );
    }

    function submitWork(uint256 listingId) external escrowExists(listingId) {
        EscrowDeal storage deal = escrows[listingId];

        IMarketplace.Listing memory listing =
            IMarketplace(marketplace).getListing(listingId);

        require(deal.status == EscrowStatus.Funded, "Escrow not funded");

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            require(msg.sender == deal.seller, "Only seller can submit delivery");
        } else {
            require(msg.sender == deal.buyer, "Only worker can submit bounty");
        }

        deal.status = EscrowStatus.Submitted;

        IMarketplace(marketplace).escrowMarkCompleted(listingId);

        emit WorkSubmitted(listingId, msg.sender);
    }

    function rejectWork(uint256 listingId, string calldata reason)
        external
        escrowExists(listingId)
    {
        EscrowDeal storage deal = escrows[listingId];

        IMarketplace.Listing memory listing =
            IMarketplace(marketplace).getListing(listingId);

        require(deal.status == EscrowStatus.Submitted, "Work not submitted");
        require(!deal.rejectedOnce, "Already rejected once");

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            require(msg.sender == deal.buyer, "Buyer must reject item delivery");
        } else {
            require(
                msg.sender == deal.seller,
                "Bounty creator must reject work"
            );
        }

        deal.rejectedOnce = true;
        deal.status = EscrowStatus.Funded;

        IMarketplace(marketplace).escrowMarkReserved(listingId);

        emit WorkRejected(listingId, msg.sender, reason);
    }

    function confirmCompletion(uint256 listingId)
        external
        escrowExists(listingId)
    {
        EscrowDeal storage deal = escrows[listingId];

        IMarketplace.Listing memory listing =
            IMarketplace(marketplace).getListing(listingId);

        require(deal.status == EscrowStatus.Submitted, "Work not submitted");

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            require(msg.sender == deal.buyer, "Buyer must confirm item delivery");
        } else {
            require(
                msg.sender == deal.seller,
                "Bounty creator must confirm completion"
            );
        }

        uint256 feeAmount = (deal.amount * platformFeeBps) / 10000;
        uint256 payoutAmount = deal.amount - feeAmount;

        deal.status = EscrowStatus.Released;

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            require(
                paymentToken.transfer(deal.seller, payoutAmount),
                "Seller payment failed"
            );
        } else {
            require(
                paymentToken.transfer(deal.buyer, payoutAmount),
                "Worker payment failed"
            );
        }

        require(
            paymentToken.transfer(feeRecipient, feeAmount),
            "Fee payment failed"
        );

        IMarketplace(marketplace).escrowMarkAsSold(listingId);

        emit EscrowReleased(
            listingId,
            deal.buyer,
            deal.seller,
            payoutAmount,
            feeAmount
        );
    }

    function sellerCancel(uint256 listingId)
        external
        escrowExists(listingId)
        onlySeller(listingId)
    {
        EscrowDeal storage deal = escrows[listingId];

        require(
            deal.status == EscrowStatus.Funded ||
                deal.status == EscrowStatus.Submitted,
            "Escrow not cancellable"
        );

        IMarketplace.Listing memory listing =
            IMarketplace(marketplace).getListing(listingId);

        address refundRecipient;

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            refundRecipient = deal.buyer;
        } else {
            refundRecipient = deal.seller;
        }

        deal.status = EscrowStatus.Cancelled;

        require(
            paymentToken.transfer(refundRecipient, deal.amount),
            "Refund failed"
        );

        IMarketplace(marketplace).escrowCancelReservedListing(listingId);

        emit EscrowCancelled(listingId);
        emit EscrowRefunded(listingId, refundRecipient, deal.amount);
    }

    function adminRefund(uint256 listingId)
        external
        escrowExists(listingId)
        onlyOwner
    {
        EscrowDeal storage deal = escrows[listingId];

        require(
            deal.status == EscrowStatus.Funded ||
                deal.status == EscrowStatus.Submitted,
            "Escrow not refundable"
        );

        IMarketplace.Listing memory listing =
            IMarketplace(marketplace).getListing(listingId);

        address refundRecipient;

        if (listing.listingType == IMarketplace.ListingType.ItemSale) {
            refundRecipient = deal.buyer;
        } else {
            refundRecipient = deal.seller;
        }

        deal.status = EscrowStatus.Refunded;

        require(
            paymentToken.transfer(refundRecipient, deal.amount),
            "Refund failed"
        );

        IMarketplace(marketplace).escrowCancelReservedListing(listingId);

        emit EscrowRefunded(listingId, refundRecipient, deal.amount);
    }

    function getEscrow(uint256 listingId)
        external
        view
        returns (EscrowDeal memory)
    {
        return escrows[listingId];
    }
}