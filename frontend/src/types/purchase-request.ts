export type PurchaseRequestStatus = "Pending" | "Accepted" | "Declined";

export interface PurchaseRequestDocument {
  id: string;
  name: string;
}

export interface PurchaseRequest {
  id: string;
  propertyId: string;
  buyerName: string;
  buyerEmail: string;
  /** null for rentals/inquiries that aren't a formal offer */
  offerPrice: number | null;
  message: string;
  status: PurchaseRequestStatus;
  submittedAt: string; // ISO date string
  documents?: PurchaseRequestDocument[];
}
