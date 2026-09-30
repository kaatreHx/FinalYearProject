import path from 'path';
import fs from 'fs';

// Images are public (served by the /uploads static mount).
export const PROPERTY_IMAGE_DIR = path.join(__dirname, '../../uploads/properties');
// Ownership documents are private: they live OUTSIDE /uploads and are only
// served through an authenticated endpoint.
export const PROPERTY_DOC_DIR = path.join(__dirname, '../../private-uploads/property-documents');

for (const dir of [PROPERTY_IMAGE_DIR, PROPERTY_DOC_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export type StoredFile = {
    kind: 'IMAGE' | 'DOCUMENT';
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
};

export function toStoredFiles(files: { [field: string]: Express.Multer.File[] } | undefined): StoredFile[] {
    const out: StoredFile[] = [];
    for (const f of files?.images ?? []) {
        out.push({ kind: 'IMAGE', fileName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size });
    }
    for (const f of files?.documents ?? []) {
        out.push({ kind: 'DOCUMENT', fileName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size });
    }
    return out;
}

export function storedFilePath(kind: 'IMAGE' | 'DOCUMENT', fileName: string) {
    return path.join(kind === 'IMAGE' ? PROPERTY_IMAGE_DIR : PROPERTY_DOC_DIR, path.basename(fileName));
}

/** Best-effort disk cleanup; never throws. */
export function removeStoredFiles(files: { kind: 'IMAGE' | 'DOCUMENT'; fileName: string }[]) {
    for (const f of files) {
        fs.unlink(storedFilePath(f.kind, f.fileName), () => undefined);
    }
}
