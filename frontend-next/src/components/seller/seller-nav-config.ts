type Translate = (key: string, values?: Record<string, string | number>) => string;

export type SellerNavItem = {
  href: string;
  label: string;
  matchers: string[];
};

export type SellerNavGroup = {
  key: string;
  label: string;
  items: SellerNavItem[];
};

function item(href: string, label: string, matchers?: string[]): SellerNavItem {
  return {
    href,
    label,
    matchers: matchers ?? [href],
  };
}

export function getSellerNavGroups(t: Translate): SellerNavGroup[] {
  return [
    {
      key: "overview",
      label: t("sellerShell.groups.overview"),
      items: [
        item("/seller/dashboard", t("sellerShell.dashboard"), ["/seller", "/seller/dashboard"]),
        item("/seller/notifications", t("sellerShell.notifications")),
      ],
    },
    {
      key: "orders",
      label: "Orders",
      items: [
        item("/seller/orders", t("sellerShell.orders")),
        item("/seller/payments-to-confirm", t("sellerShell.toConfirm")),
        item("/seller/returns", t("sellerShell.returns")),
      ],
    },
    {
      key: "products",
      label: "Products",
      items: [
        item("/seller/products", t("sellerShell.products")),
        item("/seller/import/wildberries", t("sellerShell.wbExcel")),
        item("/seller/import/wildberries-api", t("sellerShell.wbSync")),
        item("/seller/ai-images", t("sellerShell.aiImages")),
      ],
    },
    {
      key: "growth",
      label: "Growth",
      items: [
        item("/seller/reviews", t("sellerShell.reviews")),
        item("/seller/messages", t("sellerShell.messages")),
        item("/seller/campaigns", t("sellerShell.campaigns")),
        item(
          "/seller/recommendations-analytics",
          t("sellerShell.recommendationAnalytics"),
        ),
      ],
    },
    {
      key: "operations",
      label: t("sellerShell.groups.operations"),
      items: [item("/seller/support-cases", t("sellerShell.support"))],
    },
    {
      key: "finance",
      label: "Finance",
      items: [
        item("/seller/billing", "Billing"),
        item("/seller/payment-settings", t("sellerShell.paymentSettings")),
        item("/seller/finance", t("sellerShell.finance")),
      ],
    },
    {
      key: "settings",
      label: "Support & settings",
      items: [
        item("/seller/onboarding", t("sellerShell.onboarding")),
        item("/seller/settings", t("sellerShell.settings")),
      ],
    },
  ];
}

export function isSellerNavItemActive(pathname: string, navItem: SellerNavItem) {
  return navItem.matchers.some((matcher) => {
    if (matcher === "/seller") {
      return pathname === "/seller" || pathname === "/seller/dashboard";
    }
    return pathname === matcher || pathname.startsWith(`${matcher}/`);
  });
}
