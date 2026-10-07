import type {
  Property,
  PropertyFilters,
  PropertyType,
  VerificationStatus,
} from "@/types/property";
import { apiFetch, openProtectedFile } from "@/lib/http";
import { getFileUrl } from "@/lib/kycApplications";

// ---------------------------------------------------------------------------
// Mapping: backend <-> frontend vocabulary
// ---------------------------------------------------------------------------
const TYPE_FROM_API: Record<string, PropertyType> = {
  HOUSE: "House",
  APARTMENT: "Apartment",
  LAND: "Land",
  COMMERCIAL: "Commercial",
};
export const TYPE_TO_API: Record<PropertyType, string> = {
  House: "HOUSE",
  Apartment: "APARTMENT",
  Land: "LAND",
  Commercial: "COMMERCIAL",
};

// The UI works in m², the backend stores sq ft.
export const SQFT_PER_SQM = 10.7639;
export const sqmToSqft = (sqm: number) => Math.round(sqm * SQFT_PER_SQM * 100) / 100;
const sqftToSqm = (sqft: number) => Math.round(sqft / SQFT_PER_SQM);

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING: "Pending review",
  DISPATCHED: "With government",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  MINTING: "Minting…",
  MINTED: "NFT minted",
};

export const isPublicStatus = (s: VerificationStatus) => s === "VERIFIED" || s === "MINTED";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapApiProperty(raw: any): Property {
  const seller = raw.seller;
  return {
    id: raw.id,
    plotRef: raw.landRegistrationNumber ?? `#${String(raw.id).slice(0, 8).toUpperCase()}`,
    title: raw.title,
    description: raw.description ?? "",
    address: raw.street ?? "",
    city: raw.city ?? "",
    zip: raw.zip ?? "",
    price: Number(raw.price),
    status: "For Sale",
    type: TYPE_FROM_API[raw.propertyType] ?? "House",
    beds: raw.bedrooms ?? 0,
    baths: raw.bathrooms ?? 0,
    parking: 0,
    areaSqm: sqftToSqm(Number(raw.areaSqFt)),
    imageSeed: raw.id,
    imageUrls: (raw.images ?? []).map((i: any) => getFileUrl(i.url)),
    ownerId: seller?.id ?? raw.sellerId ?? "",
    ownerName: seller ? `${seller.firstName} ${seller.lastName}`.trim() : "",
    latitude: null,
    longitude: null,
    createdAt: raw.createdAt,

    verificationStatus: raw.status,
    verifiedAt: raw.verifiedAt ?? null,
    landRegistrationNumber: raw.landRegistrationNumber ?? null,
    documents: (raw.documents ?? []).map((d: any) => ({
      id: d.id,
      originalName: d.originalName,
      url: getFileUrl(d.url),
    })),
    rejectReason: raw.rejectReason ?? null,
    governmentRefNumber: raw.governmentRefNumber ?? null,
    verificationNotes: raw.verificationNotes ?? null,
    ownerWalletAddress: raw.ownerWalletAddress ?? null,
    tokenId: raw.tokenId ?? null,
    contractAddress: raw.contractAddress ?? null,
    mintTxHash: raw.mintTxHash ?? null,
  };
}

// ---------------------------------------------------------------------------
// Document labelling
// The backend stores only the file name, so the seller's chosen document type
// travels as a "<type>__" prefix on it and is turned back into a label here.
// ---------------------------------------------------------------------------
export const PROPERTY_DOCUMENT_OPTIONS = [
  { value: "ownership_deed", label: "Ownership deed / lalpurja" },
  { value: "land_survey", label: "Land survey / naksa" },
  { value: "tax_clearance", label: "Tax clearance certificate" },
  { value: "other", label: "Other" },
];

export function tagDocumentFile(file: File, type: string): File {
  return new File([file], `${type}__${file.name}`, { type: file.type });
}

export function describeDocument(originalName: string): { label: string; fileName: string } {
  const match = /^([a-z_]+)__(.+)$/.exec(originalName);
  const option = match && PROPERTY_DOCUMENT_OPTIONS.find((o) => o.value === match[1]);
  return option && match
    ? { label: option.label, fileName: match[2] }
    : { label: "Document", fileName: originalName };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
export function formatPrice(price: number, status: Property["status"]) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);

  return status === "For Rent" ? `${formatted}/mo` : formatted;
}

/** "12 Willow Court, Kathmandu" — or just "Kathmandu" when the street is hidden. */
export function formatAddress(property: Pick<Property, "address" | "city">) {
  return [property.address, property.city].filter(Boolean).join(", ");
}

export function propertyImage(property: Property, index: number, w: number, h: number): string | null {
  const url = property.imageUrls[index];
  if (url) return url;
  return index === 0 ? `https://picsum.photos/seed/${property.imageSeed}/${w}/${h}` : null;
}

// Kathmandu Valley — default map center for the location picker.
export const DEFAULT_MAP_CENTER = { latitude: 27.7172, longitude: 85.324 };

// ---------------------------------------------------------------------------
// Client-side filtering (search text + bedrooms; type/price are sent to the API)
// ---------------------------------------------------------------------------
export function filterProperties(
  properties: Property[],
  filters: PropertyFilters
): Property[] {
  const query = filters.query.trim().toLowerCase();

  return properties.filter((property) => {
    if (
      query &&
      !`${property.title} ${property.address} ${property.city} ${property.zip} ${property.plotRef}`
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    if (filters.type !== "All" && property.type !== filters.type) return false;
    if (filters.minPrice !== null && property.price < filters.minPrice) return false;
    if (filters.maxPrice !== null && property.price > filters.maxPrice) return false;
    if (filters.minBeds !== null && property.beds < filters.minBeds) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Public marketplace: VERIFIED + MINTED listings only. */
export async function fetchPublicProperties(
  filters: Pick<PropertyFilters, "type" | "minPrice" | "maxPrice">
): Promise<Property[]> {
  const out: Property[] = [];
  for (let page = 1; page <= 10; page++) {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filters.type !== "All") params.set("propertyType", TYPE_TO_API[filters.type]);
    if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));

    const res = await apiFetch<{ data: unknown[]; total: number }>(`/properties?${params}`, {
      auth: "none",
    });
    out.push(...res.data.map(mapApiProperty));
    if (res.data.length === 0 || out.length >= res.total) break;
  }
  return out;
}

/** Public if VERIFIED/MINTED; otherwise only the owner or a government officer can load it. */
export async function fetchProperty(id: string): Promise<Property> {
  return mapApiProperty(await apiFetch(`/properties/${encodeURIComponent(id)}`));
}

export async function fetchMyProperties(status?: VerificationStatus): Promise<Property[]> {
  const query = status ? `?status=${status}` : "";
  const rows = await apiFetch<unknown[]>(`/properties/mine${query}`, { auth: "required" });
  return rows.map(mapApiProperty);
}

export interface NewPropertyInput {
  title: string;
  description: string;
  type: PropertyType;
  price: number;
  areaSqm: number;
  beds: number | null;
  baths: number | null;
  address: string;
  city: string;
  zip: string;
  landRegistrationNumber: string;
}

export async function createProperty(
  input: NewPropertyInput,
  photos: File[],
  documents: File[]
): Promise<Property> {
  const fd = new FormData();
  fd.append("title", input.title);
  fd.append("description", input.description);
  fd.append("propertyType", TYPE_TO_API[input.type]);
  fd.append("price", String(input.price));
  fd.append("areaSqFt", String(sqmToSqft(input.areaSqm)));
  if (input.beds !== null) fd.append("bedrooms", String(input.beds));
  if (input.baths !== null) fd.append("bathrooms", String(input.baths));
  fd.append("street", input.address);
  fd.append("city", input.city);
  fd.append("zip", input.zip);
  fd.append("landRegistrationNumber", input.landRegistrationNumber);
  // Field names must match the backend's propertyUpload multer middleware.
  photos.forEach((file) => fd.append("images", file));
  documents.forEach((file) => fd.append("documents", file));

  return mapApiProperty(await apiFetch("/properties", { method: "POST", formData: fd, auth: "required" }));
}

export async function deleteProperty(id: string): Promise<void> {
  await apiFetch(`/properties/${encodeURIComponent(id)}`, { method: "DELETE", auth: "required" });
}

export async function mintProperty(id: string): Promise<Property> {
  return mapApiProperty(
    await apiFetch(`/properties/${encodeURIComponent(id)}/mint`, {
      method: "POST",
      json: {},
      auth: "required",
    })
  );
}

export function openPropertyDocument(doc: { url: string }) {
  return openProtectedFile(doc.url);
}
