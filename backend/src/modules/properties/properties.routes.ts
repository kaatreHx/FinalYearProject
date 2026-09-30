import { Router } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware';
import { propertyUpload } from '../../middleware/upload.middleware';
import { create, update, remove, mine, list, getOne, downloadDocument, metadata, mint } from './properties.controller';

const router = Router();

// Public marketplace (VERIFIED + MINTED only)
router.get('/', list);

// Seller
router.get('/mine', requireAuth, mine);                       // must stay above '/:id'
router.post('/', requireAuth, propertyUpload, create);        // creates in PENDING

// ERC-721 tokenURI target (public by design: wallets/marketplaces fetch it)
router.get('/:id/metadata', metadata);

// Private ownership documents: owner or government only
router.get('/:id/documents/:fileId', requireAuth, downloadDocument);

// Single property: public if VERIFIED/MINTED, otherwise owner/government only
router.get('/:id', optionalAuth, getOne);
router.put('/:id', requireAuth, propertyUpload, update);      // only PENDING / REJECTED
router.delete('/:id', requireAuth, remove);                   // only PENDING / REJECTED
router.post('/:id/mint', requireAuth, mint);                  // only VERIFIED

export default router;
