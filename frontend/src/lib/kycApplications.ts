import type { KycApplication, KycState, KycStatus, KycSubmission } from "@/types/kyc";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

// Turns a server-relative path like "/uploads/kyc/xyz.jpg" (or a bare
// filename, or an already-absolute/blob/data URL) into something an <img>
// tag can load directly.
export function getFileUrl(path: string | null): string {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const apiBase = API_BASE_URL || "http://localhost:4000/api";
  const baseUrl = apiBase.replace(/\/api\/?$/, "");
  const cleanPath = path.startsWith("/") ? path : `/uploads/${path}`;
  return `${baseUrl}${cleanPath}`;
}

function buildKycFormData(
  payload: Partial<KycSubmission>,
  files: { front?: File | null; back?: File | null; selfie?: File | null }
): FormData {
  const formData = new FormData();

  if (payload.firstName !== undefined) formData.append("firstName", payload.firstName);
  if (payload.middleName) formData.append("middleName", payload.middleName);
  if (payload.lastName !== undefined) formData.append("lastName", payload.lastName);
  if (payload.dob !== undefined) formData.append("dob", payload.dob);
  if (payload.gender !== undefined) formData.append("gender", payload.gender);

  if (payload.documentType !== undefined) formData.append("documentType", payload.documentType);
  if (payload.documentNumber !== undefined) formData.append("documentNumber", payload.documentNumber);
  if (payload.documentExpiryDate !== undefined)
    formData.append("documentExpiryDate", payload.documentExpiryDate);

  if (payload.street !== undefined) formData.append("street", payload.street);
  if (payload.city !== undefined) formData.append("city", payload.city);
  if (payload.zip !== undefined) formData.append("zip", payload.zip);

  // Field names must match the backend's kycUpload multer middleware.
  if (files.front) formData.append("documentFront", files.front);
  if (files.back) formData.append("documentBack", files.back);
  if (files.selfie) formData.append("selfie", files.selfie);

  return formData;
}

// First-time submission — all three files are required by the backend.
export async function submitKyc(
  payload: KycSubmission,
  files: { front: File | null; back: File | null; selfie: File | null }
): Promise<KycState> {
  const formData = buildKycFormData(payload, files);

  const res = await fetch(`${API_BASE_URL}/kyc`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? errorBody?.message ?? "Couldn't submit your documents.");
  }

  return res.json() as Promise<KycState>;
}

// Edit an existing (REJECTED) application. Only send the fields/files that
// actually changed — anything omitted is left as-is on the backend, so a
// user can replace just the one document that had an issue.
export async function updateKyc(
  payload: Partial<KycSubmission>,
  files: { front?: File | null; back?: File | null; selfie?: File | null }
): Promise<KycState> {
  const formData = buildKycFormData(payload, files);

  const res = await fetch(`${API_BASE_URL}/kyc`, {
    method: "PATCH",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? errorBody?.message ?? "Couldn't update your documents.");
  }

  return res.json() as Promise<KycState>;
}

export async function loadKycApplicationMe(): Promise<KycState> {
  const res = await fetch(`${API_BASE_URL}/kyc/me`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (res.status === 404) {
    // No application submitted yet — not an error state for this screen.
    return {
      firstName: "",
      lastName: "",
      dob: "",
      gender: "MALE",
      documentType: "CITIZENSHIP",
      documentNumber: "",
      documentExpiryDate: "",
      street: "",
      city: "",
      zip: "",
      status: "not_submitted",
      submittedAt: null,
      documentFrontUrl: null,
      documentBackUrl: null,
      selfieUrl: null,
    };
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? errorBody?.message ?? "Couldn't load your documents.");
  }

  return res.json() as Promise<KycState>;
}

// --- Admin ---

export async function fetchAdminKycApplications(
  status?: KycStatus | "All"
): Promise<KycApplication[]> {
  const query = status && status !== "All" ? `?status=${status}` : "";
  const res = await fetch(`${API_BASE_URL}/admin/kyc${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? errorBody?.message ?? "Couldn't load KYC applications.");
  }

  return res.json() as Promise<KycApplication[]>;
}

export async function decideKycApplication(
  id: string,
  status: "APPROVED" | "REJECTED",
  rejectReason?: string
): Promise<KycApplication> {
  const res = await fetch(`${API_BASE_URL}/admin/kyc/${id}/decision`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ status, rejectReason }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error ?? errorBody?.message ?? "Couldn't save the decision.");
  }

  return res.json() as Promise<KycApplication>;
}

export function formatSubmittedDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
