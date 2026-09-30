const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

export function sanitizeProfileInput(data: { email?: string; phone?: string }) {
    const clean: typeof data = {};

    if (data.email !== undefined) {
        const trimmed = data.email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmed)) throw new Error('Invalid email format');
        clean.email = trimmed;
    }

    if (data.phone !== undefined) {
        const trimmed = data.phone.trim();
        if (!PHONE_REGEX.test(trimmed)) throw new Error('Invalid phone format');
        clean.phone = trimmed;
    }

    return clean;
}

import type { KycInput } from "../types/kyc";

export function sanitizeKycInput(data: KycInput) {
    const firstName = data.firstName?.trim();
    const middleName = data.middleName?.trim();
    const lastName = data.lastName?.trim();
    const documentNumber = data.documentNumber?.trim();
    const street = data.street?.trim();
    const city = data.city?.trim();
    const zip = data.zip?.trim();

    if (!firstName || !lastName) throw new Error('First name and last name are required');
    if (!documentNumber) throw new Error('Document number is required');
    if (!street || !city || !zip) throw new Error('Complete address is required');

    const dob = new Date(data.dob);
    if (isNaN(dob.getTime())) throw new Error('Invalid date of birth');

    const documentExpiryDate = new Date(data.documentExpiryDate);
    if (isNaN(documentExpiryDate.getTime())) throw new Error('Invalid document expiry date');
    if (documentExpiryDate < new Date()) throw new Error('Document has already expired');

    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) throw new Error('Applicant must be at least 18 years old');

    return {
        firstName,
        middleName,
        lastName,
        dob,
        gender: data.gender,
        documentType: data.documentType,
        documentNumber,
        documentExpiryDate,
        street,
        city,
        zip,
    };
}
// ---------------------------------------------------------------------------
// Property listing validation
// ---------------------------------------------------------------------------
import type { PropertyInput } from '../types/property';
import { AppError } from './errors';

const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL'];
const MONEY_REGEX = /^\d{1,16}(\.\d{1,2})?$/;
export const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

function requiredText(value: unknown, label: string, min: number, max: number) {
    const v = typeof value === 'string' ? value.trim() : '';
    if (v.length < min) throw new AppError(400, `${label} is required${min > 1 ? ` (min ${min} characters)` : ''}`);
    if (v.length > max) throw new AppError(400, `${label} must be at most ${max} characters`);
    return v;
}

function optionalCount(value: unknown, label: string) {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new AppError(400, `${label} must be a whole number between 0 and 100`);
    return n;
}

export function sanitizePropertyInput(data: PropertyInput) {
    const title = requiredText(data.title, 'Title', 3, 150);
    const description = requiredText(data.description, 'Description', 10, 5000);
    const street = requiredText(data.street, 'Street', 1, 200);
    const city = requiredText(data.city, 'City', 1, 100);
    const zip = requiredText(data.zip, 'Zip', 1, 20);
    const landRegistrationNumber = requiredText(data.landRegistrationNumber, 'Land registration number', 3, 100);

    if (!PROPERTY_TYPES.includes(data.propertyType)) {
        throw new AppError(400, `propertyType must be one of: ${PROPERTY_TYPES.join(', ')}`);
    }

    const price = String(data.price ?? '').trim();
    if (!MONEY_REGEX.test(price) || Number(price) <= 0) throw new AppError(400, 'Price must be a positive amount (max 2 decimals)');

    const areaSqFt = Number(data.areaSqFt);
    if (!Number.isFinite(areaSqFt) || areaSqFt <= 0) throw new AppError(400, 'areaSqFt must be a positive number');

    let ownerWalletAddress: string | undefined;
    if (data.ownerWalletAddress !== undefined && String(data.ownerWalletAddress).trim() !== '') {
        ownerWalletAddress = String(data.ownerWalletAddress).trim();
        if (!WALLET_REGEX.test(ownerWalletAddress)) throw new AppError(400, 'ownerWalletAddress must be a valid 0x wallet address');
    }

    return {
        title,
        description,
        propertyType: data.propertyType,
        price,
        areaSqFt,
        bedrooms: optionalCount(data.bedrooms, 'bedrooms'),
        bathrooms: optionalCount(data.bathrooms, 'bathrooms'),
        street,
        city,
        zip,
        landRegistrationNumber,
        ownerWalletAddress,
    };
}
