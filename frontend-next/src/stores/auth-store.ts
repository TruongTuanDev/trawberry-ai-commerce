"use client";

import { create } from "zustand";
import { currentUserRequest, type CurrentUserResponse } from "@/lib/auth-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const AUTH_STORAGE_KEY = "strawberry-next-auth";

type PersistedAuth = {
  token: string | null;
  refreshToken: string | null;
  user: CurrentUserResponse | null;
};

type AuthState = PersistedAuth & {
  hydrated: boolean;
  setSession: (payload: PersistedAuth) => void;
  hydrate: () => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  setSession: (payload) => {
    save(payload);
    set({
      token: payload.token,
      refreshToken: payload.refreshToken,
      user: payload.user,
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
        token: parsed.token,
        refreshToken: parsed.refreshToken,
        user: parsed.user,
        hydrated: true,
      });
    } catch {
      clear();
      set({ token: null, refreshToken: null, user: null, hydrated: true });
    }
  },
  refreshMe: async () => {
    const token = get().token;
    if (!token) {
      return;
    }

    const user = await currentUserRequest(token);
    get().setSession({
      token,
      refreshToken: get().refreshToken,
      user,
    });
  },
  logout: () => {
    clear();
    useSellerWorkspaceStore.getState().clear();
    set({
      token: null,
      refreshToken: null,
      user: null,
    });
  },
}));
