"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function AuthBootstrap() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
    hydrateWorkspace();
  }, [hydrate, hydrateWorkspace]);

  return null;
}
