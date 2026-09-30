import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors';

// Must be registered AFTER all routes. Catches errors thrown by middleware
// (multer size limits, file-type filters) that never reach a controller try/catch.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
}
