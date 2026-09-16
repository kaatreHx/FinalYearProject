import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
        cb(new Error('Only JPEG, PNG, WEBP images or PDF documents are allowed'));
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