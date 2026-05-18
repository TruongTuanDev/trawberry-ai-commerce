import {
  USER_ROLES,
  type UserRole,
} from '../../common/constants/roles.constant';

export const LEGACY_AUTH_COOKIE_NAME = 'access_token';

export const ROLE_ACCESS_COOKIE_NAMES: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: 'admin_access_token',
  [USER_ROLES.SELLER]: 'seller_access_token',
  [USER_ROLES.CUSTOMER]: 'customer_access_token',
};

export const ROLE_REFRESH_COOKIE_NAMES: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: 'admin_refresh_token',
  [USER_ROLES.SELLER]: 'seller_refresh_token',
  [USER_ROLES.CUSTOMER]: 'customer_refresh_token',
};

export const ALL_ROLE_ACCESS_COOKIE_NAMES = Object.values(
  ROLE_ACCESS_COOKIE_NAMES,
);
export const ALL_ROLE_REFRESH_COOKIE_NAMES = Object.values(
  ROLE_REFRESH_COOKIE_NAMES,
);
