import { Prisma, PropertyStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import type { PropertyInput } from '../../types/property';
import { sanitizePropertyInput, WALLET_REGEX } from '../../utils/validate';
import { AppError } from '../../utils/errors';
import { StoredFile, removeStoredFiles, storedFilePath } from '../../utils/files';
import { isGovernmentUser } from '../../middleware/role.middleware';
import { assertNftConfigured, mintPropertyNft, MintError } from '../nft/nft.service';

/*
 * Lifecycle
 *
 *   PENDING ──dispatch──▶ DISPATCHED ──verify──▶ VERIFIED ──mint──▶ MINTING ──▶ MINTED
 *      │                      │                     ▲                  │
 *      └──────reject──────────┴──▶ REJECTED         └──── (failed, safe to retry)
 *                                      │
 *                                      └── seller edits & resubmits ──▶ PENDING
 */

const PUBLIC_STATUSES: PropertyStatus[] = ['VERIFIED', 'MINTED'];
const SELLER_EDITABLE: PropertyStatus[] = ['PENDING', 'REJECTED'];

const fullInclude = {
    files: true,
    seller: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.PropertyInclude;

type PropertyFull = Prisma.PropertyGetPayload<{ include: typeof fullInclude }>;

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------
function fileViews(p: PropertyFull, includeDocuments: boolean) {
    return {
        images: p.files
            .filter((f) => f.kind === 'IMAGE')
            .map((f) => ({ id: f.id, url: `/uploads/properties/${f.fileName}` })),
        documents: includeDocuments
            ? p.files
                  .filter((f) => f.kind === 'DOCUMENT')
                  .map((f) => ({ id: f.id, originalName: f.originalName, url: `/api/properties/${p.id}/documents/${f.id}` }))
            : undefined,
    };
}

/** Everything – for the owner and government officers only. */
function toFullView(p: PropertyFull) {
    const { files, ...rest } = p;
    return { ...rest, ...fileViews(p, true) };
}

/** Marketplace view: no street address, documents, reg. number or internal review fields. */
function toPublicView(p: PropertyFull) {
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        propertyType: p.propertyType,
        price: p.price,
        areaSqFt: p.areaSqFt,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        city: p.city,
        zip: p.zip,
        status: p.status,
        tokenId: p.tokenId,
        contractAddress: p.contractAddress,
        mintTxHash: p.mintTxHash,
        seller: p.seller,
        createdAt: p.createdAt,
        ...fileViews(p, false),
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function logStatus(
    tx: Prisma.TransactionClient,
    propertyId: string,
    fromStatus: PropertyStatus | null,
    toStatus: PropertyStatus,
    actorId: string,
    note?: string
) {
    return tx.propertyStatusLog.create({ data: { propertyId, fromStatus, toStatus, actorId, note } });
}

function parseIdList(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    const s = String(value).trim();
    if (s.startsWith('[')) {
        try { return JSON.parse(s).map(String); } catch { throw new AppError(400, 'removeFileIds must be a JSON array or comma-separated list'); }
    }
    return s.split(',').map((x) => x.trim()).filter(Boolean);
}

async function assertNoDuplicateRegistration(landRegistrationNumber: string, excludeId?: string) {
    const dup = await prisma.property.findFirst({
        where: {
            landRegistrationNumber,
            status: { not: 'REJECTED' },
            ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
    });
    if (dup) throw new AppError(409, 'A property with this land registration number is already listed');
}

// ---------------------------------------------------------------------------
// Seller
// ---------------------------------------------------------------------------
export async function createProperty(userId: string, raw: PropertyInput, uploaded: StoredFile[]) {
    const kyc = await prisma.kycApplication.findUnique({ where: { userId } });
    if (!kyc || kyc.status !== 'APPROVED') throw new AppError(403, 'Your KYC must be approved before you can list a property');

    const clean = sanitizePropertyInput(raw);
    if (!uploaded.some((f) => f.kind === 'IMAGE')) throw new AppError(400, 'At least one property photo (images) is required');
    if (!uploaded.some((f) => f.kind === 'DOCUMENT')) throw new AppError(400, 'At least one ownership document (documents) is required for government verification');

    await assertNoDuplicateRegistration(clean.landRegistrationNumber);

    const property = await prisma.property.create({
        data: {
            ...clean,
            sellerId: userId,
            status: 'PENDING',
            files: { create: uploaded },
            statusLogs: { create: { fromStatus: null, toStatus: 'PENDING', actorId: userId, note: 'Listing created' } },
        },
        include: fullInclude,
    });
    return toFullView(property);
}

export async function listMyProperties(userId: string, status?: string) {
    if (status && !(status in PropertyStatus)) throw new AppError(400, `status must be one of: ${Object.keys(PropertyStatus).join(', ')}`);
    const rows = await prisma.property.findMany({
        where: { sellerId: userId, ...(status ? { status: status as PropertyStatus } : {}) },
        include: fullInclude,
        orderBy: { createdAt: 'desc' },
    });
    return rows.map(toFullView);
}

export async function updateProperty(
    userId: string,
    id: string,
    raw: PropertyInput,
    uploaded: StoredFile[],
    removeFileIdsRaw: unknown
) {
    const clean = sanitizePropertyInput(raw);
    const removeIds = parseIdList(removeFileIdsRaw);

    const existing = await prisma.property.findUnique({ where: { id }, include: { files: true } });
    if (!existing || existing.sellerId !== userId) throw new AppError(404, 'Property not found');
    await assertNoDuplicateRegistration(clean.landRegistrationNumber, id);

    const toRemove = existing.files.filter((f) => removeIds.includes(f.id));

    await prisma.$transaction(async (tx) => {
        // Status guard in the WHERE clause closes the race with a government officer acting at the same moment.
        const res = await tx.property.updateMany({
            where: { id, sellerId: userId, status: { in: SELLER_EDITABLE } },
            data: {
                ...clean,
                status: 'PENDING',
                rejectReason: null,
                verificationNotes: null,
                governmentRefNumber: null,
                verifiedById: null,
                verifiedAt: null,
                dispatchedAt: null,
            },
        });
        if (res.count !== 1) throw new AppError(409, 'Property can only be edited while PENDING or after being REJECTED');

        if (toRemove.length) await tx.propertyFile.deleteMany({ where: { id: { in: toRemove.map((f) => f.id) }, propertyId: id } });
        if (uploaded.length) await tx.propertyFile.createMany({ data: uploaded.map((f) => ({ ...f, propertyId: id })) });

        const remaining = await tx.propertyFile.findMany({ where: { propertyId: id }, select: { kind: true } });
        if (!remaining.some((f) => f.kind === 'IMAGE')) throw new AppError(400, 'At least one property photo is required');
        if (!remaining.some((f) => f.kind === 'DOCUMENT')) throw new AppError(400, 'At least one ownership document is required');

        await logStatus(tx, id, existing.status, 'PENDING', userId, existing.status === 'REJECTED' ? 'Edited and resubmitted after rejection' : 'Listing edited');
    });

    removeStoredFiles(toRemove);
    return getPropertyForViewer(id, userId);
}

export async function deleteProperty(userId: string, id: string) {
    const existing = await prisma.property.findUnique({ where: { id }, include: { files: true } });
    if (!existing || existing.sellerId !== userId) throw new AppError(404, 'Property not found');

    const res = await prisma.property.deleteMany({ where: { id, sellerId: userId, status: { in: SELLER_EDITABLE } } });
    if (res.count !== 1) throw new AppError(409, 'Only PENDING or REJECTED properties can be deleted');

    removeStoredFiles(existing.files);
    return { message: 'Property deleted' };
}

// ---------------------------------------------------------------------------
// Public / shared reads
// ---------------------------------------------------------------------------
export async function listPublicProperties(query: Record<string, any>) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));

    const where: Prisma.PropertyWhereInput = { status: { in: PUBLIC_STATUSES } };
    if (query.city) where.city = { contains: String(query.city) };
    if (query.propertyType) where.propertyType = String(query.propertyType) as any;
    if (query.minPrice || query.maxPrice) {
        where.price = {};
        if (query.minPrice) where.price.gte = String(query.minPrice);
        if (query.maxPrice) where.price.lte = String(query.maxPrice);
    }

    const [total, rows] = await Promise.all([
        prisma.property.count({ where }),
        prisma.property.findMany({ where, include: fullInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { data: rows.map(toPublicView), page, limit, total };
}

export async function getPropertyForViewer(id: string, viewerId?: string) {
    const p = await prisma.property.findUnique({ where: { id }, include: fullInclude });
    if (!p) throw new AppError(404, 'Property not found');

    const privileged = !!viewerId && (p.sellerId === viewerId || (await isGovernmentUser(viewerId)));
    if (privileged) return toFullView(p);
    if (PUBLIC_STATUSES.includes(p.status)) return toPublicView(p);
    throw new AppError(404, 'Property not found'); // don't reveal that unverified listings exist
}

export async function getDocumentFile(propertyId: string, fileId: string, viewerId: string) {
    const file = await prisma.propertyFile.findFirst({
        where: { id: fileId, propertyId, kind: 'DOCUMENT' },
        include: { property: { select: { sellerId: true } } },
    });
    if (!file) throw new AppError(404, 'Document not found');
    if (file.property.sellerId !== viewerId && !(await isGovernmentUser(viewerId))) throw new AppError(404, 'Document not found');
    return { path: storedFilePath('DOCUMENT', file.fileName), originalName: file.originalName, mimeType: file.mimeType };
}

/** ERC-721 tokenURI payload. Deliberately excludes street address and seller personal data. */
export async function getNftMetadata(id: string) {
    const p = await prisma.property.findUnique({ where: { id }, include: fullInclude });
    if (!p || (p.status !== 'MINTING' && p.status !== 'MINTED')) throw new AppError(404, 'Metadata not found');
    const base = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
    const firstImage = p.files.find((f) => f.kind === 'IMAGE');
    return {
        name: p.title,
        description: p.description,
        image: firstImage ? `${base}/uploads/properties/${firstImage.fileName}` : undefined,
        external_url: `${base}/api/properties/${p.id}`,
        attributes: [
            { trait_type: 'Property Type', value: p.propertyType },
            { trait_type: 'Area (sq ft)', value: p.areaSqFt },
            { trait_type: 'City', value: p.city },
            { trait_type: 'Government Reference', value: p.governmentRefNumber },
            { trait_type: 'Verified At', display_type: 'date', value: p.verifiedAt ? Math.floor(p.verifiedAt.getTime() / 1000) : undefined },
        ],
    };
}

// ---------------------------------------------------------------------------
// Government workflow
// ---------------------------------------------------------------------------
export async function listForReview(status?: string) {
    const s = status ?? 'PENDING';
    if (!(s in PropertyStatus)) throw new AppError(400, `status must be one of: ${Object.keys(PropertyStatus).join(', ')}`);
    const rows = await prisma.property.findMany({
        where: { status: s as PropertyStatus },
        include: fullInclude,
        orderBy: { createdAt: 'asc' }, // oldest first = review queue
    });
    return rows.map(toFullView);
}

export async function getStatusHistory(id: string) {
    return prisma.propertyStatusLog.findMany({ where: { propertyId: id }, orderBy: { createdAt: 'asc' } });
}

async function governmentTransition(
    id: string,
    officerId: string,
    from: PropertyStatus[],
    to: PropertyStatus,
    data: Prisma.PropertyUpdateManyMutationInput,
    note?: string
) {
    const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.property.findUnique({ where: { id } });
        if (!current) throw new AppError(404, 'Property not found');
        if (current.sellerId === officerId) throw new AppError(403, 'You cannot review your own listing');
        if (!from.includes(current.status)) throw new AppError(409, `Cannot move a ${current.status} property to ${to}`);

        const res = await tx.property.updateMany({ where: { id, status: current.status }, data: { ...data, status: to } });
        if (res.count !== 1) throw new AppError(409, 'Property was changed by someone else, please reload and retry');

        await logStatus(tx, id, current.status, to, officerId, note);
        return tx.property.findUniqueOrThrow({ where: { id }, include: fullInclude });
    });
    return toFullView(updated);
}

export function dispatchProperty(id: string, officerId: string, note?: string) {
    return governmentTransition(id, officerId, ['PENDING'], 'DISPATCHED', { dispatchedAt: new Date() }, note ?? 'Dispatched for government verification');
}

export function verifyProperty(id: string, officerId: string, input: { governmentRefNumber?: string; notes?: string }) {
    const ref = input.governmentRefNumber?.trim();
    if (!ref) throw new AppError(400, 'governmentRefNumber is required to verify a property');
    return governmentTransition(
        id, officerId, ['DISPATCHED'], 'VERIFIED',
        { verifiedAt: new Date(), verifiedById: officerId, governmentRefNumber: ref, verificationNotes: input.notes?.trim() || null, rejectReason: null },
        input.notes?.trim() || 'Verified by government'
    );
}

export function rejectProperty(id: string, officerId: string, reason?: string) {
    const r = reason?.trim();
    if (!r) throw new AppError(400, 'A rejection reason is required');
    return governmentTransition(id, officerId, ['PENDING', 'DISPATCHED'], 'REJECTED', { rejectReason: r }, r);
}

// ---------------------------------------------------------------------------
// NFT minting (seller-triggered, only after government verification)
// ---------------------------------------------------------------------------
export async function mintProperty(userId: string, id: string, walletFromBody?: string) {
    const p = await prisma.property.findUnique({ where: { id } });
    if (!p || p.sellerId !== userId) throw new AppError(404, 'Property not found');
    if (p.status !== 'VERIFIED') {
        throw new AppError(409, p.status === 'MINTED' || p.status === 'MINTING'
            ? `Property is already ${p.status}`
            : `Only VERIFIED properties can be minted (current status: ${p.status})`);
    }

    const wallet = (walletFromBody?.trim() || p.ownerWalletAddress) ?? '';
    if (!WALLET_REGEX.test(wallet)) throw new AppError(400, 'A valid walletAddress is required to receive the NFT');
    assertNftConfigured();

    // Atomically claim the property so two concurrent requests can't both mint.
    await prisma.$transaction(async (tx) => {
        const claim = await tx.property.updateMany({ where: { id, sellerId: userId, status: 'VERIFIED' }, data: { status: 'MINTING', ownerWalletAddress: wallet } });
        if (claim.count !== 1) throw new AppError(409, 'Property is already being minted');
        await logStatus(tx, id, 'VERIFIED', 'MINTING', userId, `Minting to ${wallet}`);
    });

    const tokenUri = `${(process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '')}/api/properties/${id}/metadata`;

    try {
        const minted = await mintPropertyNft(wallet, tokenUri);
        const updated = await prisma.$transaction(async (tx) => {
            await tx.property.update({
                where: { id },
                data: { status: 'MINTED', tokenId: minted.tokenId, contractAddress: minted.contractAddress, mintTxHash: minted.txHash, mintedAt: new Date() },
            });
            await logStatus(tx, id, 'MINTING', 'MINTED', userId, `Token #${minted.tokenId}, tx ${minted.txHash}`);
            return tx.property.findUniqueOrThrow({ where: { id }, include: fullInclude });
        });
        return toFullView(updated);
    } catch (err) {
        const e = err instanceof MintError ? err : new MintError(String((err as any)?.message ?? err), false);
        if (e.safeToRetry) {
            await prisma.$transaction(async (tx) => {
                await tx.property.update({ where: { id }, data: { status: 'VERIFIED' } });
                await logStatus(tx, id, 'MINTING', 'VERIFIED', userId, `Mint failed: ${e.message}`);
            });
            throw new AppError(502, `NFT minting failed, you can retry: ${e.message}`);
        }
        // Outcome unknown: stay in MINTING and keep the tx hash for reconciliation rather than risk a double mint.
        await prisma.$transaction(async (tx) => {
            if (e.txHash) await tx.property.update({ where: { id }, data: { mintTxHash: e.txHash } });
            await logStatus(tx, id, 'MINTING', 'MINTING', userId, `Mint outcome unknown: ${e.message}`);
        });
        throw new AppError(502, `Mint transaction was submitted but not confirmed${e.txHash ? ` (tx ${e.txHash})` : ''}. The property stays in MINTING until it is reconciled.`);
    }
}
