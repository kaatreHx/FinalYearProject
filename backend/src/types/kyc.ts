export interface KycInput {
    firstName: string;
    middleName?: string;
    lastName: string;
    dob: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    documentType: 'NATIONAL_ID' | 'CITIZENSHIP' | 'PASSPORT' | 'DRIVERS_LICENSE';
    documentNumber: string;
    documentExpiryDate: string;
    street: string;
    city: string;
    zip: string;
}

export interface KycFiles {
    documentFrontUrl: string;
    documentBackUrl: string;
    selfieUrl: string;
}