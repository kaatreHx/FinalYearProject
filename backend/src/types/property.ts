export type PropertyTypeInput = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL';

// Multipart form fields arrive as strings, so numeric fields accept both.
export interface PropertyInput {
    title: string;
    description: string;
    propertyType: PropertyTypeInput;
    price: string | number;
    areaSqFt: string | number;
    bedrooms?: string | number;
    bathrooms?: string | number;
    street: string;
    city: string;
    zip: string;
    landRegistrationNumber: string;
    ownerWalletAddress?: string;
}
