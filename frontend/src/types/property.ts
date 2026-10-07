export type PropertyType = "House" | "Apartment" | "Land" | "Commercial";
// The backend only models ownership sales, so every listing is "For Sale".
// "For Rent" is kept so existing components/CSS keep compiling.
export type ListingStatus = "For Sale" | "For Rent";

// Backend lifecycle: PENDING -> DISPATCHED -> VERIFIED -> MINTING -> MINTED (or REJECTED)
export type VerificationStatus =
  | "PENDING"
  | "DISPATCHED"
  | "VERIFIED"
  | "REJECTED"
  | "MINTING"
  | "MINTED";

export interface PropertyDocument {
  id: string;
  originalName: string;
  /** Absolute URL; needs the bearer token (use openProtectedFile). */
  url: string;
}

export interface Property {
  id: string;
  /** Land registration number for the owner/government, short id for the public. */
  plotRef: string;
  title: string;
  description: string;
  /** Street. Empty in the public view (the backend hides it until you own/review the listing). */
  address: string;
  city: string;
  zip: string;
  price: number;
  status: ListingStatus;
  type: PropertyType;
  beds: number;
  baths: number;
  parking: number; // not stored by the backend; always 0
  areaSqm: number;
  imageSeed: string; // placeholder seed when a listing has no photos
  imageUrls: string[];
  ownerId: string;
  ownerName: string;
  latitude: number | null; // not stored by the backend; resolved by geocoding
  longitude: number | null;
  createdAt: string; // ISO date

  // --- verification / NFT (from the backend) ---
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  // Only present for the owner and government officers:
  landRegistrationNumber: string | null;
  documents: PropertyDocument[];
  rejectReason: string | null;
  governmentRefNumber: string | null;
  verificationNotes: string | null;
  ownerWalletAddress: string | null;
  // NFT (public once minted)
  tokenId: string | null;
  contractAddress: string | null;
  mintTxHash: string | null;
}

export interface StatusLogEntry {
  id: string;
  fromStatus: VerificationStatus | null;
  toStatus: VerificationStatus;
  actorId: string;
  note: string | null;
  createdAt: string;
}

export interface PropertyFilters {
  query: string;
  type: PropertyType | "All";
  minPrice: number | null;
  maxPrice: number | null;
  minBeds: number | null;
}

export const DEFAULT_FILTERS: PropertyFilters = {
  query: "",
  type: "All",
  minPrice: null,
  maxPrice: null,
  minBeds: null,
};
