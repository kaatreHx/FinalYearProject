import { Request, Response } from 'express';
import fs from 'fs';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sendError } from '../../utils/errors';
import { removeStoredFiles, toStoredFiles } from '../../utils/files';
import {
    createProperty, updateProperty, deleteProperty, listMyProperties, listPublicProperties,
    getPropertyForViewer, getDocumentFile, getNftMetadata, mintProperty,
} from './properties.service';
import { AppError } from '../../utils/errors';

type UploadedFields = { [field: string]: Express.Multer.File[] } | undefined;

export async function create(req: AuthRequest, res: Response) {
    const uploaded = toStoredFiles(req.files as UploadedFields);
    try {
        res.status(201).json(await createProperty(req.user!.userId, req.body, uploaded));
    } catch (err) {
        removeStoredFiles(uploaded); // don't leave orphan files behind when validation fails
        sendError(res, err);
    }
}

export async function update(req: AuthRequest, res: Response) {
    const uploaded = toStoredFiles(req.files as UploadedFields);
    try {
        res.status(200).json(await updateProperty(req.user!.userId, req.params.id, req.body, uploaded, req.body.removeFileIds));
    } catch (err) {
        removeStoredFiles(uploaded);
        sendError(res, err);
    }
}

export async function remove(req: AuthRequest, res: Response) {
    try {
        res.status(200).json(await deleteProperty(req.user!.userId, req.params.id));
    } catch (err) { sendError(res, err); }
}

export async function mine(req: AuthRequest, res: Response) {
    try {
        res.status(200).json(await listMyProperties(req.user!.userId, req.query.status as string | undefined));
    } catch (err) { sendError(res, err); }
}

export async function list(req: Request, res: Response) {
    try {
        res.status(200).json(await listPublicProperties(req.query));
    } catch (err) { sendError(res, err); }
}

export async function getOne(req: AuthRequest, res: Response) {
    try {
        res.status(200).json(await getPropertyForViewer(req.params.id, req.user?.userId));
    } catch (err) { sendError(res, err); }
}

export async function downloadDocument(req: AuthRequest, res: Response) {
    try {
        const doc = await getDocumentFile(req.params.id, req.params.fileId, req.user!.userId);
        if (!fs.existsSync(doc.path)) throw new AppError(404, 'Document file is missing on the server');
        res.setHeader('Content-Type', doc.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
        res.sendFile(doc.path);
    } catch (err) { sendError(res, err); }
}

export async function metadata(req: Request, res: Response) {
    try {
        res.status(200).json(await getNftMetadata(req.params.id));
    } catch (err) { sendError(res, err); }
}

export async function mint(req: AuthRequest, res: Response) {
    try {
        res.status(200).json(await mintProperty(req.user!.userId, req.params.id, req.body?.walletAddress));
    } catch (err) { sendError(res, err); }
}
