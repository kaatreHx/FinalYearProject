import { prisma } from '../../config/db';
import type { KycInput, KycFiles } from '../../types/kyc';
import { sanitizeKycInput } from '../../utils/validate';

export async function submitKyc(userId: string, rawData: KycInput, files: KycFiles) {
    const existing = await prisma.kycApplication.findUnique({ where: { userId } });
    if (existing && existing.status === 'PENDING') {
        throw new Error('You already have a pending KYC application');
    }
    if (existing && existing.status === 'APPROVED') {
        throw new Error('KYC already approved');
    }

    const clean = sanitizeKycInput(rawData);

    const application = await prisma.kycApplication.upsert({
        where: { userId },
        update: {
            ...clean,
            ...files,
            status: 'PENDING',
            rejectReason: null,
        },
        create: {
            userId,
            ...clean,
            ...files,
            status: 'PENDING',
        },
    });

    return application;
}

export async function getMyKyc(userId: string) {
    const application = await prisma.kycApplication.findUnique({ where: { userId } });
    if (!application) throw new Error('No KYC application found');
    return application;
}