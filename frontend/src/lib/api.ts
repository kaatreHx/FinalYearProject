import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL;

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(
      errorBody?.message ?? "Something went wrong. Please try again."
    );
  }

  return res.json() as Promise<T>;
}

export function login(payload: LoginPayload) {
  return request<AuthResponse>("/auth/login", payload);
}

export function register(payload: RegisterPayload) {
  return request<AuthResponse>("/auth/register", payload);
}
