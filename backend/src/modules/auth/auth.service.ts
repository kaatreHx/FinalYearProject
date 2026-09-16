import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db';

const JWT_SECRET = process.env.JWT_SECRET;

export async function registerUser(firstName: string, lastName: string, email: string, password: string, isAgent: boolean) {

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) throw new Error('Email already registered');

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await tx.user.create({
            data: { firstName, lastName, email, password: hashedPassword, isAgent },
        });

        return user
    })

    const token = jwt.sign({ userId: result.id, role: result.isAgent }, JWT_SECRET, { expiresIn: '7d' });
    return { user: { id: result.id, firstName: result.firstName, lastName: result.lastName, email: result.email, isAgent: result.isAgent }, token };
}

export async function loginUser(email: string, password: string, keepSignedIn: boolean) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    const expiresIn = keepSignedIn ? "30d" : "20s";

    const token = jwt.sign({ userId: user.id, isAgent: user.isAgent }, JWT_SECRET, { expiresIn: expiresIn });
    return { user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, isAgent: user.isAgent }, token };
}