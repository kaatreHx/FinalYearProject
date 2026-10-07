export interface LoginPayload {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isAgent: boolean;
  walletAddress: string | null;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAgent: boolean;
  walletAddress: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  /** Returned only after registration so the user can back up their key. */
  walletPrivateKey?: string;
}

export interface ApiError {
  message: string;
}
