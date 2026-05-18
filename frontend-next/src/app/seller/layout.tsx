import { SellerRouteShell } from "@/components/seller/seller-route-shell";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerRouteShell>{children}</SellerRouteShell>;
}
