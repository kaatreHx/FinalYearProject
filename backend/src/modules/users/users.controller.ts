import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { updateProfile, updatePassword, getMe } from './users.service';

export async function getProfile(req: AuthRequest, res: Response) {
    try {
        const user = await getMe(req.user!.userId);
        res.status(200).json(user);
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
}

export async function editProfile(req: AuthRequest, res: Response) {
    try {
        const { firstName, lastName, email, phone } = req.body;
        const user = await updateProfile(req.user!.userId, { firstName, lastName, email, phone });
        res.status(200).json(user);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
}

export async function changePassword(req: AuthRequest, res: Response) {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        }
        const result = await updatePassword(req.user!.userId, currentPassword, newPassword);
        res.status(200).json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
}