export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
