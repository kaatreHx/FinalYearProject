// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Only the backend's minter wallet (the owner) can mint, so tokens only exist for government-verified properties.
contract PropertyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;

    constructor(address initialOwner) ERC721("Verified Property", "VPROP") Ownable(initialOwner) {}

    function safeMint(address to, string memory uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(id);
    }
}
