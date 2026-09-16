import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { kycUpload } from '../../middleware/upload.middleware';
import { submitKycApplication, getKycStatus } from './kyc.controller';

const router = Router();

router.post('/', requireAuth, kycUpload, submitKycApplication);
router.get('/me', requireAuth, getKycStatus);

export default router;