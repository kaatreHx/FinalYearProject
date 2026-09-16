export type UserRole = "seller" | "buyer";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  joinedAt: string; // ISO date
}
