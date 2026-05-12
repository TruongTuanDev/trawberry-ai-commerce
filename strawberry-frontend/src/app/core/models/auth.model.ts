export type UserRole = 'CUSTOMER' | 'SELLER' | 'ADMIN';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  email: string;
  fullName: string;
  /** Role returned by the backend JWT response — must match UserRole values exactly */
  role: string;
}

export interface CurrentUser {
  email: string;
  fullName: string;
  role: UserRole;
  token: string;
}

/** Safe role coercion — handles Spring Security 'ROLE_' prefix if present */
export function coerceRole(raw: string | undefined | null): UserRole {
  if (!raw) return 'CUSTOMER';
  const role = raw.replace('ROLE_', '');
  if (role === 'SELLER' || role === 'ADMIN') return role;
  return 'CUSTOMER';
}
