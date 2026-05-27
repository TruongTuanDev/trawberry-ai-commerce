"use client";

import { create } from "zustand";
import {
  getAdminMeRequest,
  getCustomerMeRequest,
  getAuthErrorMessage,
  getSellerMeRequest,
  logoutAdminRequest,
  logoutAllRequest,
  logoutCustomerRequest,
  logoutSellerRequest,
  type CurrentUserResponse,
} from "@/lib/auth-api";
import { useCartStore } from "@/stores/cart-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const AUTH_STORAGE_KEY = "strawberry-next-auth";

export type AuthRoleKey = "admin" | "seller" | "customer";

type PersistedAuth = {
  adminUser: CurrentUserResponse | null;
  sellerUser: CurrentUserResponse | null;
  customerUser: CurrentUserResponse | null;
};

type RoleStatus = Record<AuthRoleKey, boolean>;
type RoleErrors = Record<AuthRoleKey, string | null>;

type AuthState = PersistedAuth & {
  hydrated: boolean;
  sessionLoading: RoleStatus;
  sessionError: RoleErrors;
  setRoleSession: (role: AuthRoleKey, user: CurrentUserResponse | null) => void;
  setSession: (payload: { user: CurrentUserResponse | null }) => void;
  hydrate: () => void;
  refreshRole: (role: AuthRoleKey) => Promise<boolean>;
  logoutRole: (role: AuthRoleKey) => Promise<void>;
  logoutAll: () => Promise<void>;
};

const emptyLoadingState: RoleStatus = {
  admin: false,
  seller: false,
  customer: false,
};

const emptyErrorState: RoleErrors = {
  admin: null,
  seller: null,
  customer: null,
};

function roleField(role: AuthRoleKey) {
  return role === "admin"
    ? "adminUser"
    : role === "seller"
      ? "sellerUser"
      : "customerUser";
}

function inferRole(user: CurrentUserResponse | null): AuthRoleKey | null {
  if (!user) {
    return null;
  }

  return user.role === "ADMIN"
    ? "admin"
    : user.role === "SELLER"
      ? "seller"
      : user.role === "CUSTOMER"
        ? "customer"
        : null;
}

function getMeRequest(role: AuthRoleKey) {
  return role === "admin"
    ? getAdminMeRequest
    : role === "seller"
      ? getSellerMeRequest
      : getCustomerMeRequest;
}

function getLogoutRequest(role: AuthRoleKey) {
  return role === "admin"
    ? logoutAdminRequest
    : role === "seller"
      ? logoutSellerRequest
      : logoutCustomerRequest;
}

function persist(payload: PersistedAuth) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function clearStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function afterRoleStateChange(role: AuthRoleKey, user: CurrentUserResponse | null) {
  if (role === "customer") {
    useCartStore.getState().hydrate();
  }

  if (role === "seller" && !user) {
    useSellerWorkspaceStore.getState().clear();
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  adminUser: null,
  sellerUser: null,
  customerUser: null,
  hydrated: false,
  sessionLoading: emptyLoadingState,
  sessionError: emptyErrorState,
  setRoleSession: (role, user) => {
    const field = roleField(role);
    const nextPersisted: PersistedAuth = {
      adminUser: role === "admin" ? user : get().adminUser,
      sellerUser: role === "seller" ? user : get().sellerUser,
      customerUser: role === "customer" ? user : get().customerUser,
    };

    persist(nextPersisted);
    afterRoleStateChange(role, user);
    set((state) => ({
      ...state,
      [field]: user,
      sessionError: {
        ...state.sessionError,
        [role]: null,
      },
    }));
  },
  setSession: (payload) => {
    const role = inferRole(payload.user);
    if (!role) {
      return;
    }
    get().setRoleSession(role, payload.user);
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
      set({
        adminUser: parsed.adminUser ?? null,
        sellerUser: parsed.sellerUser ?? null,
        customerUser: parsed.customerUser ?? null,
        hydrated: true,
      });
    } catch {
      clearStorage();
      set({
        adminUser: null,
        sellerUser: null,
        customerUser: null,
        hydrated: true,
        sessionError: emptyErrorState,
      });
    }
  },
  refreshRole: async (role) => {
    set((state) => ({
      sessionLoading: {
        ...state.sessionLoading,
        [role]: true,
      },
      sessionError: {
        ...state.sessionError,
        [role]: null,
      },
    }));

    try {
      const user = await getMeRequest(role)();
      get().setRoleSession(role, user);
      set((state) => ({
        sessionLoading: {
          ...state.sessionLoading,
          [role]: false,
        },
        sessionError: {
          ...state.sessionError,
          [role]: null,
        },
      }));
      return true;
    } catch (error) {
      const field = roleField(role);
      const nextPersisted: PersistedAuth = {
        adminUser: role === "admin" ? null : get().adminUser,
        sellerUser: role === "seller" ? null : get().sellerUser,
        customerUser: role === "customer" ? null : get().customerUser,
      };

      persist(nextPersisted);
      afterRoleStateChange(role, null);
      set((state) => ({
        ...state,
        [field]: null,
        sessionLoading: {
          ...state.sessionLoading,
          [role]: false,
        },
        sessionError: {
          ...state.sessionError,
          [role]: getAuthErrorMessage(error, "session", { role }),
        },
      }));
      return false;
    }
  },
  logoutRole: async (role) => {
    try {
      await getLogoutRequest(role)();
    } catch {
      // Keep local cleanup even if the cookie is already gone.
    } finally {
      const field = roleField(role);
      const nextPersisted: PersistedAuth = {
        adminUser: role === "admin" ? null : get().adminUser,
        sellerUser: role === "seller" ? null : get().sellerUser,
        customerUser: role === "customer" ? null : get().customerUser,
      };

      persist(nextPersisted);
      afterRoleStateChange(role, null);
      set((state) => ({
        ...state,
        [field]: null,
        sessionLoading: {
          ...state.sessionLoading,
          [role]: false,
        },
        sessionError: {
          ...state.sessionError,
          [role]: null,
        },
      }));
    }
  },
  logoutAll: async () => {
    try {
      await logoutAllRequest();
    } catch {
      // Keep local cleanup even if some cookies are already missing.
    } finally {
      clearStorage();
      useCartStore.getState().hydrate();
      useSellerWorkspaceStore.getState().clear();
      set({
        adminUser: null,
        sellerUser: null,
        customerUser: null,
        hydrated: true,
        sessionLoading: emptyLoadingState,
        sessionError: emptyErrorState,
      });
    }
  },
}));
