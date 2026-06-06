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
      key: "catalog",
      label: t("sellerShell.groups.catalog"),
      items: [
        item("/seller/products", t("sellerShell.products")),
        item("/seller/import/wildberries", t("sellerShell.wbExcel")),
        item("/seller/import/wildberries-api", t("sellerShell.wbSync")),
        item("/seller/ai-images", t("sellerShell.aiImages")),
      ],
    },
    {
      key: "sales",
      label: t("sellerShell.groups.sales"),
      items: [
        item("/seller/orders", t("sellerShell.orders")),
        item("/seller/returns", t("sellerShell.returns")),
        item("/seller/reviews", t("sellerShell.reviews")),
        item("/seller/messages", t("sellerShell.messages")),
      ],
    },
    {
      key: "operations",
      label: t("sellerShell.groups.operations"),
      items: [item("/seller/support-cases", t("sellerShell.support"))],
    },
    {
      key: "payments",
      label: t("sellerShell.groups.payments"),
      items: [
        item("/seller/payment-settings", t("sellerShell.paymentSettings")),
        item("/seller/payments-to-confirm", t("sellerShell.toConfirm")),
        item("/seller/payments", t("sellerShell.payments")),
        item("/seller/finance", t("sellerShell.finance")),
      ],
    },
    {
      key: "settings",
      label: t("sellerShell.groups.settings"),
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
