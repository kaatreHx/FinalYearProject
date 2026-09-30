import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sendError } from '../../utils/errors';
import {
    listForReview, getPropertyForViewer, getStatusHistory,
    dispatchProperty, verifyProperty, rejectProperty,
} from '../properties/properties.service';

export async function queue(req: AuthRequest, res: Response) {
    try { res.status(200).json(await listForReview(req.query.status as string | undefined)); }
    catch (err) { sendError(res, err); }
}

export async function detail(req: AuthRequest, res: Response) {
    try {
        const property = await getPropertyForViewer(req.params.id, req.user!.userId);
        const history = await getStatusHistory(req.params.id);
        res.status(200).json({ ...property, history });
    } catch (err) { sendError(res, err); }
}

export async function dispatch(req: AuthRequest, res: Response) {
    try { res.status(200).json(await dispatchProperty(req.params.id, req.user!.userId, req.body?.note)); }
    catch (err) { sendError(res, err); }
}

export async function verify(req: AuthRequest, res: Response) {
    try {
        const { governmentRefNumber, notes } = req.body ?? {};
        res.status(200).json(await verifyProperty(req.params.id, req.user!.userId, { governmentRefNumber, notes }));
    } catch (err) { sendError(res, err); }
}

export async function reject(req: AuthRequest, res: Response) {
    try { res.status(200).json(await rejectProperty(req.params.id, req.user!.userId, req.body?.reason)); }
    catch (err) { sendError(res, err); }
}
