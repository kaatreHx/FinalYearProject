// Single place that knows how to talk to the backend: base URL, bearer token,
// JSON/multipart bodies, and the backend's `{ error: string }` error shape.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function sessionExpired() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

interface RequestOptions {
  method?: string;
  json?: unknown;
  formData?: FormData;
  /**
   * "required" - must be signed in (redirects to /login if not)
   * "optional" - send the token if there is one (default)
   * "none"     - never send the token (public endpoints)
   */
  auth?: "required" | "optional" | "none";
}

export async function apiFetch<T>(
  path: string,
  { method = "GET", json, formData, auth = "optional" }: RequestOptions = {}
): Promise<T> {
  const token = getToken();

  if (auth === "required" && !token) {
    sessionExpired();
    throw new ApiError("Please sign in to continue.", 401);
  }

  const headers: Record<string, string> = {};
  if (auth !== "none" && token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (formData) {
    body = formData; // browser sets the multipart boundary itself
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    if (res.status === 401 && token && auth !== "none") sessionExpired();
    throw new ApiError(
      errBody?.error ?? errBody?.message ?? "Something went wrong. Please try again.",
      res.status
    );
  }

  return res.json() as Promise<T>;
}

/** Fetches a protected file with the bearer token and opens it in a new tab. */
export async function openProtectedFile(url: string): Promise<void> {
  // Open the tab synchronously (inside the click handler) so popup blockers allow it.
  const tab = window.open("", "_blank");
  try {
    const token = getToken();
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new ApiError(errBody?.error ?? "Couldn't open that document.", res.status);
    }
    const blobUrl = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = blobUrl;
    else window.location.href = blobUrl;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
