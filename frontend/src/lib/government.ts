import type { Property, StatusLogEntry, VerificationStatus } from "@/types/property";
import { apiFetch } from "@/lib/http";
import { mapApiProperty } from "@/lib/properties";

// Government-officer endpoints. The backend checks the officer flag on every call,
// so a normal user simply gets a 403 here.

export async function fetchReviewQueue(status: VerificationStatus): Promise<Property[]> {
  const rows = await apiFetch<unknown[]>(`/government/properties?status=${status}`, {
    auth: "required",
  });
  return rows.map(mapApiProperty);
}

export async function fetchReviewDetail(
  id: string
): Promise<{ property: Property; history: StatusLogEntry[] }> {
  const raw = await apiFetch<{ history: StatusLogEntry[] }>(
    `/government/properties/${encodeURIComponent(id)}`,
    { auth: "required" }
  );
  return { property: mapApiProperty(raw), history: raw.history ?? [] };
}

async function act(id: string, action: string, json: unknown): Promise<Property> {
  return mapApiProperty(
    await apiFetch(`/government/properties/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      json,
      auth: "required",
    })
  );
}

export const dispatchProperty = (id: string, note?: string) => act(id, "dispatch", { note });
export const verifyProperty = (id: string, governmentRefNumber: string, notes?: string) =>
  act(id, "verify", { governmentRefNumber, notes });
export const rejectProperty = (id: string, reason: string) => act(id, "reject", { reason });
