// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PropertyNFT
 * @notice Each verified land property is minted as a unique ERC721 NFT.
 *
 * Key rules:
 *  - Only the government (contract owner) can mint a property NFT.
 *  - Only verified properties are ever minted (the government mints after verification).
 *  - Every ownership change is recorded on-chain so a property keeps a full,
 *    transparent ownership history.
 */
contract PropertyNFT is ERC721URIStorage, Ownable {
    /// @notice A single entry in the ownership history of a property.
    struct OwnershipRecord {
        address owner;
        uint256 since; // block timestamp when this owner received the property
    }

    /// @notice tokenId => ordered list of owners (the last one is the current owner).
    mapping(uint256 => OwnershipRecord[]) private _ownershipHistory;

    /// @notice Guards against minting the same tokenId twice.
    mapping(uint256 => bool) public propertyMinted;

    event PropertyMinted(uint256 indexed tokenId, address indexed owner, string uri);

    constructor(address government) ERC721("Land Chain Property", "LCP") Ownable(government) {}

    /**
     * @notice Mint a verified property as an NFT to its owner.
     * @dev Only the government can call this.
     * @param to Address of the property owner.
     * @param tokenId Unique token id (1-based, assigned by the backend).
     * @param uri Off-chain metadata URI (points to property details).
     */
    function mintProperty(address to, uint256 tokenId, string memory uri) external onlyOwner {
        require(!propertyMinted[tokenId], "PropertyNFT: token already minted");
        propertyMinted[tokenId] = true;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        _ownershipHistory[tokenId].push(OwnershipRecord({ owner: to, since: block.timestamp }));

        emit PropertyMinted(tokenId, to, uri);
    }

    /// @notice Return the full ownership history of a property.
    function getOwnershipHistory(uint256 tokenId) external view returns (OwnershipRecord[] memory) {
        return _ownershipHistory[tokenId];
    }

    /**
     * @dev OpenZeppelin v5 transfer hook. Whenever a property is transferred we append
     * the new owner to the on-chain history. Minting (from == 0) is handled in mintProperty.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = super._update(to, tokenId, auth);
        if (from != address(0)) {
            _ownershipHistory[tokenId].push(OwnershipRecord({ owner: to, since: block.timestamp }));
        }
        return from;
    }
}
