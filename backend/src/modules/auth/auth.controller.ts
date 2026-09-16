import { Request, Response } from 'express';
import { registerUser, loginUser } from './auth.service';

export async function register(req: Request, res: Response) {
    try {
        const { firstName, lastName, email, password, isAgent } = req.body;
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ error: 'fullname, lastname, email, and password are required' });
        }
        const result = await registerUser(firstName, lastName, email, password, isAgent);
        res.status(201).json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
}

export async function login(req: Request, res: Response) {
    try {
        const { email, password, keepSignedIn } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }
        const result = await loginUser(email, password, keepSignedIn);
        res.status(200).json(result);
    } catch (err: any) {
        res.status(401).json({ error: err.message });
    }
}