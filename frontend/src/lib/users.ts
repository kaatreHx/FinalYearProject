import type { PasswordChangePayload, UserProfile } from "@/types/profile";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function updateProfile(payload: UserProfile) {
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message ?? "Couldn't update your profile.");
  }
  return res.json() as Promise<UserProfile>;
}

export async function changePassword(payload: PasswordChangePayload) {
  const res = await fetch(`${API_BASE_URL}/users/me/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message ?? "Couldn't change your password.");
  }
  return res.json() as Promise<{ success: boolean }>;
}

export async function me() {
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("token")}`,
    },
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.message ?? "Couldn't get your profile.");
  }
  return res.json() as Promise<UserProfile>;
}
