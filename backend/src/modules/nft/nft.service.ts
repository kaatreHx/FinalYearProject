import { ethers } from 'ethers';
import { AppError } from '../../utils/errors';

// Minimal ABI of contracts/PropertyNFT.sol
const ABI = [
    'function safeMint(address to, string uri) returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export class MintError extends Error {
    /**
     * safeToRetry = true  -> nothing is on-chain (never submitted, or tx reverted).
     * safeToRetry = false -> tx was broadcast but its outcome is unknown; retrying
     *                        could mint twice, so a human/job must reconcile txHash.
     */
    constructor(message: string, public safeToRetry: boolean, public txHash?: string) {
        super(message);
        this.name = 'MintError';
    }
}

function getConfig() {
    const { NFT_RPC_URL, NFT_CONTRACT_ADDRESS, NFT_MINTER_PRIVATE_KEY } = process.env;
    if (!NFT_RPC_URL || !NFT_CONTRACT_ADDRESS || !NFT_MINTER_PRIVATE_KEY) return null;
    return { rpcUrl: NFT_RPC_URL, contractAddress: NFT_CONTRACT_ADDRESS, privateKey: NFT_MINTER_PRIVATE_KEY };
}

/** Call BEFORE changing any DB state so a misconfigured server doesn't flip properties to MINTING. */
export function assertNftConfigured() {
    if (!getConfig()) throw new AppError(503, 'NFT minting is not configured on this server');
}

export async function mintPropertyNft(to: string, tokenUri: string) {
    const cfg = getConfig();
    if (!cfg) throw new MintError('NFT minting is not configured', true);

    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(cfg.privateKey, provider);
    const contract = new ethers.Contract(cfg.contractAddress, ABI, signer);

    let tx: ethers.ContractTransactionResponse;
    try {
        tx = await contract.safeMint(to, tokenUri);
    } catch (e: any) {
        throw new MintError(`Could not submit mint transaction: ${e?.shortMessage ?? e?.message ?? e}`, true);
    }

    let receipt: ethers.ContractTransactionReceipt | null;
    try {
        receipt = await tx.wait(1, 120_000); // 2 min timeout
    } catch (e: any) {
        // Reverted txs throw CALL_EXCEPTION -> nothing minted, safe to retry. Anything else (timeout, RPC drop) is unknown.
        const reverted = e?.code === 'CALL_EXCEPTION';
        throw new MintError(`Mint transaction ${reverted ? 'reverted' : 'not confirmed'}: ${e?.shortMessage ?? e?.message ?? e}`, reverted, tx.hash);
    }
    if (!receipt) throw new MintError('Mint transaction not confirmed', false, tx.hash);
    if (receipt.status !== 1) throw new MintError('Mint transaction reverted', true, tx.hash);

    let tokenId: string | undefined;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== cfg.contractAddress.toLowerCase()) continue;
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed?.name === 'Transfer' && parsed.args.from === ethers.ZeroAddress) {
                tokenId = parsed.args.tokenId.toString();
                break;
            }
        } catch { /* not one of our events */ }
    }
    if (!tokenId) throw new MintError('Mint confirmed but tokenId could not be read from logs', false, tx.hash);

    return { tokenId, txHash: tx.hash, contractAddress: cfg.contractAddress };
}
