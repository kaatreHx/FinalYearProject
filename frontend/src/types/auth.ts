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
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAgent: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface ApiError {
  message: string;
}
