import crypto from 'crypto';
import { ethers } from 'ethers';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
    const secret = process.env.WALLET_ENCRYPTION_KEY;
    if (!secret || secret.length < 32) {
        throw new Error('WALLET_ENCRYPTION_KEY must be configured and at least 32 characters long');
    }
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Generates a normal Ethereum-compatible wallet.
 * The address is safe to store publicly; the private key is encrypted before
 * it is stored in PostgreSQL.
 */
export function createUserWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
    };
}

export function encryptPrivateKey(privateKey: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(privateKey, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // version:iv:authTag:ciphertext
    return [
        'v1',
        iv.toString('base64url'),
        authTag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join(':');
}

export function decryptPrivateKey(payload: string): string {
    const [version, ivB64, authTagB64, encryptedB64] = payload.split(':');
    if (version !== 'v1' || !ivB64 || !authTagB64 || !encryptedB64) {
        throw new Error('Invalid encrypted wallet key');
    }

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        getEncryptionKey(),
        Buffer.from(ivB64, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64url'));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedB64, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}
