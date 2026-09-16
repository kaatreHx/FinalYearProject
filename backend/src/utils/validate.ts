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