import { create } from "zustand";
import { getUnreadCount } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";

type NotificationStore = {
  unreadCounts: Record<AuthRoleKey, number>;
  fetchUnreadCount: (role: AuthRoleKey) => Promise<void>;
  setUnreadCount: (role: AuthRoleKey, count: number) => void;
  decrementUnreadCount: (role: AuthRoleKey, amount?: number) => void;
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  unreadCounts: {
    customer: 0,
    seller: 0,
    admin: 0,
  },
  fetchUnreadCount: async (role) => {
    try {
      const res = await getUnreadCount(role);
      get().setUnreadCount(role, res.count);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  },
  setUnreadCount: (role, count) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [role]: Math.max(0, count),
      },
    }));
  },
  decrementUnreadCount: (role, amount = 1) => {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [role]: Math.max(0, state.unreadCounts[role] - amount),
      },
    }));
  },
}));
