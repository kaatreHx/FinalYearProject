import bcrypt from 'bcryptjs';
import { prisma } from '../../config/db';
import { sanitizeProfileInput } from '../../utils/validate';


export async function updateProfile(userId: string, rawData: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
    const data = sanitizeProfileInput(rawData);

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) throw new Error('User not found');

    if (rawData.email && existingUser.email !== rawData.email) {
        const existingEmail = await prisma.user.findUnique({ where: { email: rawData.email } });
        if (existingEmail) throw new Error('Email already exists');
    }

    if (rawData.phone && existingUser.phone !== rawData.phone) {
        const existingPhone = await prisma.user.findUnique({ where: { phone: rawData.phone } });
        if (existingPhone) throw new Error('Phone already exists');
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: rawData,
    });

    return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone };
}

export async function updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new Error('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
}

export async function getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone };
}