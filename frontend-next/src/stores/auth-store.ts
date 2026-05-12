"use client";

import { create } from "zustand";
import { currentUserRequest, logoutRequest, type CurrentUserResponse } from "@/lib/auth-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const AUTH_STORAGE_KEY = "strawberry-next-auth";

type PersistedAuth = {
  user: CurrentUserResponse | null;
};

type AuthState = PersistedAuth & {
  hydrated: boolean;
  sessionLoading: boolean;
  sessionError: string | null;
  setSession: (payload: PersistedAuth) => void;
  hydrate: () => void;
  refreshMe: () => Promise<boolean>;
  logout: () => Promise<void>;
};

function save(payload: PersistedAuth) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function clear() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  sessionLoading: false,
  sessionError: null,
  setSession: (payload) => {
    save({ user: payload.user });
    set({
      user: payload.user,
      sessionError: null,
    });
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
      const parsed = JSON.parse(raw) as PersistedAuth;
      set({
        user: parsed.user,
        hydrated: true,
      });
    } catch {
      clear();
      set({ user: null, hydrated: true, sessionError: null });
    }
  },
  refreshMe: async () => {
    set({ sessionLoading: true, sessionError: null });

    try {
      const user = await currentUserRequest();
      save({ user });
      set({
        user,
        sessionLoading: false,
        sessionError: null,
      });
      return true;
    } catch (error) {
      clear();
      useSellerWorkspaceStore.getState().clear();
      set({
        user: null,
        sessionLoading: false,
        sessionError: error instanceof Error ? error.message : "Session expired.",
      });
      return false;
    }
  },
  logout: async () => {
    try {
      await logoutRequest();
    } catch {
      // Clear local auth state even if the backend cookie has already expired.
    } finally {
      clear();
      useSellerWorkspaceStore.getState().clear();
      set({
        user: null,
        sessionLoading: false,
        sessionError: null,
      });
    }
  },
}));
