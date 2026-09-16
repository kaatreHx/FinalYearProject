export type KycStatus = "not_submitted" | "PENDING" | "APPROVED" | "REJECTED";

export type KycDocumentType =
  | "NATIONAL_ID"
  | "CITIZENSHIP"
  | "PASSPORT"
  | "DRIVERS_LICENSE";

export type KycGender = "MALE" | "FEMALE" | "OTHER";

export interface KycSubmission {
  // Personal Identity
  firstName: string;
  middleName?: string;
  lastName: string;
  dob: string; // ISO date string, e.g. "1998-05-12"
  gender: KycGender;

  // Identity Document Details
  documentType: KycDocumentType;
  documentNumber: string;
  documentExpiryDate: string; // ISO date string

  // Address Information
  street: string;
  city: string;
  zip: string;
}

export interface KycState extends KycSubmission {
  status: KycStatus;
  submittedAt: string | null;
  rejectReason?: string | null;

  // Server-side file paths for whatever was last uploaded, e.g.
  // "/uploads/kyc/xyz-documentFront-123.jpg". Null until something's
  // been uploaded for that slot.
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
}

// Shape returned by the admin KYC review endpoints — a KycState plus
// which applicant it belongs to.
export interface KycApplication extends KycState {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
}
