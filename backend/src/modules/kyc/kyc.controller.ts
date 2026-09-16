import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { submitKyc, getMyKyc } from './kyc.service';

export async function submitKycApplication(req: AuthRequest, res: Response) {
    try {
        const files = req.files as { [field: string]: Express.Multer.File[] };

        if (!files?.documentFront || !files?.documentBack || !files?.selfie) {
            return res.status(400).json({ error: 'documentFront, documentBack, and selfie images are all required' });
        }

        const fileUrls = {
            documentFrontUrl: `/uploads/kyc/${req.user!.userId}/${files.documentFront[0].filename}`,
            documentBackUrl: `/uploads/kyc/${req.user!.userId}/${files.documentBack[0].filename}`,
            selfieUrl: `/uploads/kyc/${req.user!.userId}/${files.selfie[0].filename}`,
        };

        const application = await submitKyc(req.user!.userId, req.body, fileUrls);
        res.status(201).json(application);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
}

export async function getKycStatus(req: AuthRequest, res: Response) {
    try {
        const application = await getMyKyc(req.user!.userId);
        res.status(200).json(application);
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
}