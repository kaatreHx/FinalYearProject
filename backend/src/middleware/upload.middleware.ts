import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from '../utils/errors';
import { PROPERTY_IMAGE_DIR, PROPERTY_DOC_DIR } from '../utils/files';

const uploadDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const userId = (req as any).user?.userId || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `${userId}-${file.fieldname}-${Date.now()}${ext}`);
    },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/pjpeg',
        'image/png',
        'image/webp',
        'application/pdf',
    ];
    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new AppError(400, 'Only JPEG, PNG, WEBP images or PDF documents are allowed'));
    }
}

export const kycUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
}).fields([
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
]);
// ---------------------------------------------------------------------------
// Property uploads: public photos + private ownership documents
// ---------------------------------------------------------------------------
const IMAGE_TYPES: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
};
const DOC_TYPES: Record<string, string[]> = { ...IMAGE_TYPES, 'application/pdf': ['.pdf'] };

const propertyStorage = multer.diskStorage({
    destination: (_req, file, cb) => cb(null, file.fieldname === 'documents' ? PROPERTY_DOC_DIR : PROPERTY_IMAGE_DIR),
    filename: (req, file, cb) => {
        const userId = (req as any).user?.userId || 'unknown';
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${userId}-${file.fieldname}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
});

function propertyFileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const allowed = file.fieldname === 'images' ? IMAGE_TYPES : DOC_TYPES;
    const ext = path.extname(file.originalname).toLowerCase();
    // Both MIME type and extension must match (stricter than the KYC filter).
    if (allowed[file.mimetype]?.includes(ext)) return cb(null, true);
    cb(new AppError(400, file.fieldname === 'images'
        ? 'Property photos must be JPEG, PNG or WEBP'
        : 'Ownership documents must be PDF, JPEG, PNG or WEBP'));
}

export const propertyUpload = multer({
    storage: propertyStorage,
    fileFilter: propertyFileFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 15 }, // 10MB per file
}).fields([
    { name: 'images', maxCount: 10 },
    { name: 'documents', maxCount: 5 },
]);
