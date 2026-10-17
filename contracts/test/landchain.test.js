const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: current block timestamp
async function now() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

describe("Land Chain contracts", function () {
  let gov, seller, buyer, other;
  let nft, marketplace;
  const TOKEN_ID = 1;
  const PRICE = ethers.parseEther("1");
  const DOC_HASH = ethers.keccak256(ethers.toUtf8Bytes("documents-bundle"));

  beforeEach(async function () {
    [gov, seller, buyer, other] = await ethers.getSigners();

    const PropertyNFT = await ethers.getContractFactory("PropertyNFT");
    nft = await PropertyNFT.deploy(gov.address);
    await nft.waitForDeployment();

    const LandMarketplace = await ethers.getContractFactory("LandMarketplace");
    marketplace = await LandMarketplace.deploy(gov.address, await nft.getAddress());
    await marketplace.waitForDeployment();
  });

  async function mintTo(address) {
    await nft.connect(gov).mintProperty(address, TOKEN_ID, "ipfs://property-1");
  }

  it("only the government can mint a property NFT", async function () {
    await expect(
      nft.connect(other).mintProperty(other.address, TOKEN_ID, "ipfs://p1")
    ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");

    await mintTo(seller.address);
    expect(await nft.ownerOf(TOKEN_ID)).to.equal(seller.address);
  });

  it("records ownership history on mint", async function () {
    await mintTo(seller.address);
    const history = await nft.getOwnershipHistory(TOKEN_ID);
    expect(history.length).to.equal(1);
    expect(history[0].owner).to.equal(seller.address);
  });

  it("runs the full purchase flow and transfers ownership + payment", async function () {
    await mintTo(seller.address);

    // Seller lists the property (must approve the marketplace first).
    await nft.connect(seller).approve(await marketplace.getAddress(), TOKEN_ID);
    await expect(marketplace.connect(seller).listProperty(TOKEN_ID, PRICE))
      .to.emit(marketplace, "PropertyListed");

    // Buyer creates a request with a document hash.
    await expect(marketplace.connect(buyer).createRequest(TOKEN_ID, DOC_HASH))
      .to.emit(marketplace, "RequestCreated");
    const requestId = 1;

    // Seller accepts.
    await marketplace.connect(seller).acceptRequest(requestId);
    let req = await marketplace.getRequest(requestId);
    expect(req.status).to.equal(1); // Accepted

    // Buyer cannot pay before government approval.
    await expect(
      marketplace.connect(buyer).payAndTransfer(requestId, { value: PRICE })
    ).to.be.revertedWith("Marketplace: not approved");

    // Government approves.
    await marketplace.connect(gov).govApproveRequest(requestId);
    req = await marketplace.getRequest(requestId);
    expect(req.status).to.equal(2); // GovApproved

    // Buyer pays -> ownership moves and seller receives funds.
    const before = await ethers.provider.getBalance(seller.address);
    await expect(
      marketplace.connect(buyer).payAndTransfer(requestId, { value: PRICE })
    ).to.emit(marketplace, "PurchaseCompleted");

    expect(await nft.ownerOf(TOKEN_ID)).to.equal(buyer.address);
    const after = await ethers.provider.getBalance(seller.address);
    expect(after - before).to.equal(PRICE);

    // Ownership history now has two owners.
    const history = await nft.getOwnershipHistory(TOKEN_ID);
    expect(history.length).to.equal(2);
    expect(history[1].owner).to.equal(buyer.address);
  });

  it("prevents the seller from buying their own property", async function () {
    await mintTo(seller.address);
    await nft.connect(seller).approve(await marketplace.getAddress(), TOKEN_ID);
    await marketplace.connect(seller).listProperty(TOKEN_ID, PRICE);

    await expect(
      marketplace.connect(seller).createRequest(TOKEN_ID, DOC_HASH)
    ).to.be.revertedWith("Marketplace: cannot buy your own property");
  });
});
