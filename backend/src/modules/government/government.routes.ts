import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireGovernment } from '../../middleware/role.middleware';
import { queue, detail, dispatch, verify, reject } from './government.controller';

const router = Router();

router.use(requireAuth, requireGovernment);

router.get('/properties', queue);                    // ?status=PENDING (default) | DISPATCHED | ...
router.get('/properties/:id', detail);               // full record incl. documents + status history
router.post('/properties/:id/dispatch', dispatch);   // PENDING    -> DISPATCHED
router.post('/properties/:id/verify', verify);       // DISPATCHED -> VERIFIED   (needs governmentRefNumber)
router.post('/properties/:id/reject', reject);       // PENDING | DISPATCHED -> REJECTED (needs reason)

export default router;
