// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title LandMarketplace
 * @notice Handles the request-based buying and selling of verified property NFTs.
 *
 * Purchase flow enforced on-chain:
 *   1. Seller lists a verified property with a price.
 *   2. Buyer creates a request (with a hash of the off-chain documents).
 *   3. Seller accepts or rejects the request.
 *   4. Government approves the accepted request.
 *   5. Buyer pays the exact price -> NFT moves to buyer, ETH moves to seller.
 *
 * Off-chain documents are never stored on-chain, only their hash (documentHash)
 * is recorded, matching the project's security requirement.
 */
contract LandMarketplace is Ownable, ReentrancyGuard {
    IERC721 public immutable propertyNFT;

    enum RequestStatus {
        Pending,    // 0 - buyer created the request
        Accepted,   // 1 - seller accepted
        GovApproved,// 2 - government verified
        Paid,       // 3 - buyer paid, ownership transferred
        Rejected    // 4 - rejected by seller or government
    }

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    struct PurchaseRequest {
        uint256 id;
        uint256 tokenId;
        address buyer;
        address seller;
        uint256 price;
        bytes32 documentHash;
        RequestStatus status;
    }

    /// @notice tokenId => listing
    mapping(uint256 => Listing) public listings;
    /// @notice requestId => request
    mapping(uint256 => PurchaseRequest) public requests;
    /// @notice request id counter (ids start at 1)
    uint256 public requestCount;

    event PropertyListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);
    event RequestCreated(uint256 indexed requestId, uint256 indexed tokenId, address indexed buyer);
    event RequestAccepted(uint256 indexed requestId);
    event RequestRejected(uint256 indexed requestId);
    event RequestGovApproved(uint256 indexed requestId);
    event PurchaseCompleted(
        uint256 indexed requestId,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 price
    );

    constructor(address government, address nftAddress) Ownable(government) {
        propertyNFT = IERC721(nftAddress);
    }

    // ---------------------------------------------------------------------
    // Listing
    // ---------------------------------------------------------------------

    /**
     * @notice List a property for sale.
     * @dev The marketplace must be approved to transfer the token
     *      (approve() or setApprovalForAll() must be called first).
     */
    function listProperty(uint256 tokenId, uint256 price) external {
        require(propertyNFT.ownerOf(tokenId) == msg.sender, "Marketplace: not the owner");
        require(price > 0, "Marketplace: price must be > 0");
        require(
            propertyNFT.getApproved(tokenId) == address(this) ||
                propertyNFT.isApprovedForAll(msg.sender, address(this)),
            "Marketplace: approve NFT first"
        );

        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit PropertyListed(tokenId, msg.sender, price);
    }

    /// @notice Cancel an active listing (seller only).
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.seller == msg.sender, "Marketplace: not the seller");
        listing.active = false;
        emit ListingCancelled(tokenId);
    }

    // ---------------------------------------------------------------------
    // Requests
    // ---------------------------------------------------------------------

    /// @notice Buyer creates a purchase request for a listed property.
    function createRequest(uint256 tokenId, bytes32 documentHash) external returns (uint256) {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Marketplace: property not listed");
        require(listing.seller != msg.sender, "Marketplace: cannot buy your own property");

        requestCount += 1;
        requests[requestCount] = PurchaseRequest({
            id: requestCount,
            tokenId: tokenId,
            buyer: msg.sender,
            seller: listing.seller,
            price: listing.price,
            documentHash: documentHash,
            status: RequestStatus.Pending
        });

        emit RequestCreated(requestCount, tokenId, msg.sender);
        return requestCount;
    }

    /// @notice Seller accepts a pending request.
    function acceptRequest(uint256 requestId) external {
        PurchaseRequest storage request = requests[requestId];
        require(request.seller == msg.sender, "Marketplace: not the seller");
        require(request.status == RequestStatus.Pending, "Marketplace: not pending");
        request.status = RequestStatus.Accepted;
        emit RequestAccepted(requestId);
    }

    /// @notice Seller or government rejects a request.
    function rejectRequest(uint256 requestId) external {
        PurchaseRequest storage request = requests[requestId];
        require(
            request.seller == msg.sender || owner() == msg.sender,
            "Marketplace: not authorized"
        );
        require(
            request.status == RequestStatus.Pending || request.status == RequestStatus.Accepted,
            "Marketplace: cannot reject now"
        );
        request.status = RequestStatus.Rejected;
        listings[request.tokenId].active = false;
        emit RequestRejected(requestId);
    }

    /// @notice Government approves an accepted request after verifying documents.
    function govApproveRequest(uint256 requestId) external onlyOwner {
        PurchaseRequest storage request = requests[requestId];
        require(request.status == RequestStatus.Accepted, "Marketplace: seller must accept first");
        request.status = RequestStatus.GovApproved;
        emit RequestGovApproved(requestId);
    }

    /**
     * @notice Buyer pays for the property. Ownership transfers to the buyer and the
     *         payment is forwarded to the seller in the same transaction.
     */
    function payAndTransfer(uint256 requestId) external payable nonReentrant {
        PurchaseRequest storage request = requests[requestId];
        require(request.buyer == msg.sender, "Marketplace: not the buyer");
        require(request.status == RequestStatus.GovApproved, "Marketplace: not approved");
        require(msg.value == request.price, "Marketplace: incorrect payment");
        require(
            propertyNFT.ownerOf(request.tokenId) == request.seller,
            "Marketplace: seller no longer owns the property"
        );

        request.status = RequestStatus.Paid;
        listings[request.tokenId].active = false;

        // Move the property NFT from seller to buyer.
        propertyNFT.safeTransferFrom(request.seller, request.buyer, request.tokenId);

        // Forward the payment to the seller.
        (bool sent, ) = payable(request.seller).call{ value: msg.value }("");
        require(sent, "Marketplace: payment failed");

        emit PurchaseCompleted(
            requestId,
            request.tokenId,
            request.buyer,
            request.seller,
            request.price
        );
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Returns a single request (handy for the backend).
    function getRequest(uint256 requestId) external view returns (PurchaseRequest memory) {
        return requests[requestId];
    }
}
