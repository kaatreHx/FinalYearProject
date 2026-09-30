import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from './auth.middleware';

export async function isGovernmentUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGovernment: true } });
    return !!user?.isGovernment;
}

/**
 * Checks the DB (not the JWT) so that revoking an officer's access takes
 * effect immediately instead of waiting for their token to expire.
 */
export async function requireGovernment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        if (!req.user) return res.status(401).json({ error: 'No token provided' });
        if (!(await isGovernmentUser(req.user.userId))) {
            return res.status(403).json({ error: 'Government officer access required' });
        }
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
