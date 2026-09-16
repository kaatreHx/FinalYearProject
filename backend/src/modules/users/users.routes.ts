import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { getProfile, editProfile, changePassword } from './users.controller';

const router = Router();

router.get('/me', requireAuth, getProfile);
router.put('/me', requireAuth, editProfile);
router.put('/me/password', requireAuth, changePassword);

export default router;