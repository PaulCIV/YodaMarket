// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Marketplace {
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

    uint256 private nextListingId = 1;

    address public owner;
    address public escrowContract;

    mapping(uint256 => Listing) private listings;
    mapping(address => uint256[]) private sellerToListingIds;
    mapping(address => uint256[]) private buyerToListingIds;

    mapping(uint256 => address[]) private listingRequesters;
    mapping(uint256 => mapping(address => bool)) public hasRequested;
    mapping(uint256 => address) public approvedBuyer;

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 price,
        string metadataURI,
        ListingType listingType
    );

    event ListingUpdated(
        uint256 indexed listingId,
        uint256 newPrice,
        string newMetadataURI
    );

    event ListingStatusChanged(
        uint256 indexed listingId,
        ListingStatus newStatus
    );

    event BuyerAssigned(uint256 indexed listingId, address indexed buyer);

    event ListingRequested(
        uint256 indexed listingId,
        address indexed requester
    );

    event RequesterApproved(
        uint256 indexed listingId,
        address indexed requester
    );

    event EscrowContractSet(address indexed escrowContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "Not escrow");
        _;
    }

    modifier listingExists(uint256 listingId) {
        require(listings[listingId].exists, "Listing does not exist");
        _;
    }

    modifier onlySeller(uint256 listingId) {
        require(msg.sender == listings[listingId].seller, "Not the seller");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setEscrowContract(address _escrowContract) external onlyOwner {
        require(_escrowContract != address(0), "Invalid escrow address");

        escrowContract = _escrowContract;

        emit EscrowContractSet(_escrowContract);
    }

    function createListing(
        uint256 price,
        string calldata metadataURI,
        ListingType listingType
    ) external {
        require(price > 0, "Price must be greater than 0");
        require(bytes(metadataURI).length > 0, "Metadata URI required");

        uint256 listingId = nextListingId;

        listings[listingId] = Listing({
            id: listingId,
            seller: msg.sender,
            buyer: address(0),
            price: price,
            metadataURI: metadataURI,
            listingType: listingType,
            status: ListingStatus.Active,
            exists: true
        });

        sellerToListingIds[msg.sender].push(listingId);
        nextListingId++;

        emit ListingCreated(
            listingId,
            msg.sender,
            price,
            metadataURI,
            listingType
        );
    }

    function updateListing(
        uint256 listingId,
        uint256 newPrice,
        string calldata newMetadataURI
    )
        external
        listingExists(listingId)
        onlySeller(listingId)
    {
        Listing storage listing = listings[listingId];

        require(
            listing.status == ListingStatus.Active,
            "Only active listings can be updated"
        );
        require(newPrice > 0, "Price must be greater than 0");
        require(bytes(newMetadataURI).length > 0, "Metadata URI required");

        listing.price = newPrice;
        listing.metadataURI = newMetadataURI;

        emit ListingUpdated(listingId, newPrice, newMetadataURI);
    }

    function cancelActiveListing(uint256 listingId)
        external
        listingExists(listingId)
        onlySeller(listingId)
    {
        Listing storage listing = listings[listingId];

        require(
            listing.status == ListingStatus.Active,
            "Only active listings can be cancelled by seller"
        );

        listing.status = ListingStatus.Cancelled;

        emit ListingStatusChanged(listingId, ListingStatus.Cancelled);
    }

    function requestListing(uint256 listingId)
        external
        listingExists(listingId)
    {
        Listing storage listing = listings[listingId];

        require(listing.status == ListingStatus.Active, "Listing not active");
        require(msg.sender != listing.seller, "Creator cannot request own listing");
        require(!hasRequested[listingId][msg.sender], "Already requested");

        hasRequested[listingId][msg.sender] = true;
        listingRequesters[listingId].push(msg.sender);

        emit ListingRequested(listingId, msg.sender);
    }

    function approveRequester(uint256 listingId, address requester)
        external
        listingExists(listingId)
        onlySeller(listingId)
    {
        Listing storage listing = listings[listingId];

        require(listing.status == ListingStatus.Active, "Listing not active");
        require(requester != address(0), "Invalid requester");
        require(hasRequested[listingId][requester], "Requester did not request");

        approvedBuyer[listingId] = requester;

        emit RequesterApproved(listingId, requester);
    }

    function getListingRequesters(uint256 listingId)
        external
        view
        listingExists(listingId)
        returns (address[] memory)
    {
        return listingRequesters[listingId];
    }

    function escrowReserveListing(uint256 listingId, address buyer)
        external
        listingExists(listingId)
        onlyEscrow
    {
        Listing storage listing = listings[listingId];

        require(listing.status == ListingStatus.Active, "Listing is not active");
        require(buyer != address(0), "Invalid buyer");
        require(buyer != listing.seller, "Creator cannot accept own listing");
        require(approvedBuyer[listingId] == buyer, "Requester not approved");

        listing.buyer = buyer;
        listing.status = ListingStatus.Reserved;

        buyerToListingIds[buyer].push(listingId);

        emit BuyerAssigned(listingId, buyer);
        emit ListingStatusChanged(listingId, ListingStatus.Reserved);
    }

    function escrowMarkCompleted(uint256 listingId)
        external
        listingExists(listingId)
        onlyEscrow
    {
        Listing storage listing = listings[listingId];

        require(
            listing.status == ListingStatus.Reserved,
            "Listing must be reserved first"
        );
        require(listing.buyer != address(0), "No buyer assigned");

        listing.status = ListingStatus.Completed;

        emit ListingStatusChanged(listingId, ListingStatus.Completed);
    }

    function escrowMarkReserved(uint256 listingId)
        external
        listingExists(listingId)
        onlyEscrow
    {
        Listing storage listing = listings[listingId];

        require(
            listing.status == ListingStatus.Completed,
            "Listing must be completed"
        );
        require(listing.buyer != address(0), "No buyer assigned");

        listing.status = ListingStatus.Reserved;

        emit ListingStatusChanged(listingId, ListingStatus.Reserved);
    }

    function escrowMarkAsSold(uint256 listingId)
        external
        listingExists(listingId)
        onlyEscrow
    {
        Listing storage listing = listings[listingId];

        require(
            listing.status == ListingStatus.Completed,
            "Listing must be completed first"
        );
        require(listing.buyer != address(0), "No buyer assigned");

        listing.status = ListingStatus.Sold;

        emit ListingStatusChanged(listingId, ListingStatus.Sold);
    }

    function escrowCancelReservedListing(uint256 listingId)
        external
        listingExists(listingId)
        onlyEscrow
    {
        Listing storage listing = listings[listingId];

        require(
            listing.status == ListingStatus.Reserved ||
                listing.status == ListingStatus.Completed,
            "Only reserved/completed listings can be escrow-cancelled"
        );

        listing.status = ListingStatus.Cancelled;

        emit ListingStatusChanged(listingId, ListingStatus.Cancelled);
    }

    function getListing(uint256 listingId)
        external
        view
        listingExists(listingId)
        returns (Listing memory)
    {
        return listings[listingId];
    }

    function getSellerListingIds(address seller)
        external
        view
        returns (uint256[] memory)
    {
        return sellerToListingIds[seller];
    }

    function getBuyerListingIds(address buyer)
        external
        view
        returns (uint256[] memory)
    {
        return buyerToListingIds[buyer];
    }

    function getNextListingId() external view returns (uint256) {
        return nextListingId;
    }

    function getTotalListings() external view returns (uint256) {
        return nextListingId - 1;
    }
}