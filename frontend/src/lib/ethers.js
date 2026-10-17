import { ethers } from "ethers";

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);
export const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
export const NFT_ADDRESS = import.meta.env.VITE_PROPERTY_NFT_ADDRESS || "";
export const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
export const GOVERNMENT_WALLET = (import.meta.env.VITE_GOVERNMENT_WALLET || "").toLowerCase();

export const NFT_ABI = [
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getOwnershipHistory(uint256 tokenId) view returns (tuple(address owner, uint256 since)[])",
];

export const MARKETPLACE_ABI = [
  "function listProperty(uint256 tokenId, uint256 price)",
  "function cancelListing(uint256 tokenId)",
  "function createRequest(uint256 tokenId, bytes32 documentHash) returns (uint256)",
  "function acceptRequest(uint256 requestId)",
  "function rejectRequest(uint256 requestId)",
  "function payAndTransfer(uint256 requestId) payable",
  "function requestCount() view returns (uint256)",
  "function getRequest(uint256 requestId) view returns (tuple(uint256 id, uint256 tokenId, address buyer, address seller, uint256 price, bytes32 documentHash, uint8 status))",
  "function listings(uint256 tokenId) view returns (uint256 tokenId, address seller, uint256 price, bool active)",
  "event RequestCreated(uint256 indexed requestId, uint256 indexed tokenId, address indexed buyer)",
];

export function hasMetaMask() {
  return typeof window !== "undefined" && !!window.ethereum;
}

/** Ask MetaMask to switch to the local Hardhat network (adds it if missing). */
export async function switchToLocalChain() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(current, 16) === CHAIN_ID) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch (err) {
    if (err.code === 4902 || err.code === -32603) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_HEX,
            chainName: "Hardhat Localhost",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [RPC_URL],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/** Connect to MetaMask and return the signer + address. */
export async function connectWallet() {
  if (!hasMetaMask()) {
    throw new Error("MetaMask is not installed. Please install the browser extension.");
  }

  // Ask MetaMask to show the account picker so the user can choose (or switch)
  // which account to connect. This is what allows signing in with another account.
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch (err) {
    if (err && err.code === 4001) {
      throw new Error("You rejected the connection request.");
    }
    // Not supported / already granted: fall through to eth_requestAccounts.
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });
  await switchToLocalChain();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  // IMPORTANT: take the address from the signer so the wallet that signs the
  // login message is exactly the wallet we request a nonce for.
  const address = (await signer.getAddress()).toLowerCase();
  return { provider, signer, address };
}

export async function getSigner() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  return provider.getSigner();
}

export const nftContract = (runner) => new ethers.Contract(NFT_ADDRESS, NFT_ABI, runner);
export const marketContract = (runner) =>
  new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, runner);

export function shortAddr(a) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
