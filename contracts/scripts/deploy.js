const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploys the Land Chain contracts and saves the addresses to
 * ../deployments/<network>.json so the backend can pick them up.
 *
 * The GOVERNMENT address is the wallet allowed to verify properties and
 * approve transfers. In development it defaults to the deployer account.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const government = process.env.GOVERNMENT_ADDRESS || deployer.address;

  console.log("Network         :", network.name);
  console.log("Deployer        :", deployer.address);
  console.log("Government      :", government);

  const PropertyNFT = await ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy(government);
  await propertyNFT.waitForDeployment();
  const nftAddress = await propertyNFT.getAddress();
  console.log("PropertyNFT     :", nftAddress);

  const LandMarketplace = await ethers.getContractFactory("LandMarketplace");
  const marketplace = await LandMarketplace.deploy(government, nftAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("LandMarketplace :", marketplaceAddress);

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const deployments = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    government,
    propertyNFT: nftAddress,
    marketplace: marketplaceAddress,
  };
  fs.writeFileSync(
    path.join(outDir, `${network.name}.json`),
    JSON.stringify(deployments, null, 2)
  );
  console.log("\nSaved deployment to deployments/" + network.name + ".json");
  console.log("\nCopy these into backend/.env and frontend/.env:");
  console.log("  PROPERTY_NFT_ADDRESS=" + nftAddress);
  console.log("  MARKETPLACE_ADDRESS=" + marketplaceAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
