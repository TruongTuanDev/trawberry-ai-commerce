export type AuthenticatedUser = {
  sub: string;
  userId: string;
  email: string;
  role: string;
  fullName?: string | null;
};
