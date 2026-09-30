import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
    user?: { userId: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
/** Sets req.user when a valid token is present, but never rejects the request. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { userId: string; role: string };
        } catch {
            // invalid/expired token -> treat as anonymous
        }
    }
    next();
}
