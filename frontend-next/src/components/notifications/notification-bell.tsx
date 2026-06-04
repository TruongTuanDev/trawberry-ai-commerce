"use client";

import React, { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { type AuthRoleKey, useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "@/stores/notification-store";
import { NotificationDropdown } from "./notification-dropdown";
import { useI18n } from "@/i18n/use-i18n";

interface NotificationBellProps {
  role: AuthRoleKey;
}

export function NotificationBell({ role }: NotificationBellProps) {
  const { t } = useI18n(role === "admin" ? "admin" : role === "seller" ? "seller" : "customer");
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = useNotificationStore((state) => state.unreadCounts[role]);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);

  // Select corresponding user from auth store
  const user = useAuthStore((state) => {
    if (role === "customer") return state.customerUser;
    if (role === "seller") return state.sellerUser;
    if (role === "admin") return state.adminUser;
    return null;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchUnreadCount(role);

    const interval = setInterval(() => {
      void fetchUnreadCount(role);
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [role, user, fetchUnreadCount]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!mounted || !user) {
    return null;
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/12 transition cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/20"
        aria-label={role === "seller" ? t("notifications.sellerTitle") : t("notifications.customerTitle")}
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-slate-900 animate-pulse"
            data-testid="notification-unread-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          role={role}
          onClose={() => setIsOpen(false)}
          onMutation={() => void fetchUnreadCount(role)}
        />
      )}
    </div>
  );
}
export default NotificationBell;
