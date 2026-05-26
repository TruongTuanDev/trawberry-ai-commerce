"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
import {
  archiveShopOrder,
  createManualDelivery,
  getOrderDelivery,
  getShopOrders,
  markManualDeliveryFailed,
  markManualDeliveryInTransit,
  markManualDeliveryDelivered,
  type SellerFulfillmentBucket,
  type SellerOrderListItem,
  type SellerOrdersResponse,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";

const sellerTabs: Array<{ value: SellerFulfillmentBucket; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "ASSEMBLING", label: "Assembling" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARCHIVED", label: "Archived" },
];

type ShipmentPanelState = {
  order: SellerOrderListItem;
  manualYandexOrderId: string;
  trackingUrl: string;
  note: string;
};

export function SellerOrdersPageClient() {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [response, setResponse] = useState<SellerOrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SellerFulfillmentBucket>("NEW");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipmentPanel, setShipmentPanel] = useState<ShipmentPanelState | null>(null);
  const { run: runAction, isRunning } = useActionFeedback();
  const localizedSellerTabs = useMemo(
    () =>
      sellerTabs.map((tab) => ({
        value: tab.value,
        label:
          tab.value === "ALL"
            ? t("sellerOrders.all")
            : tab.value === "NEW"
              ? t("sellerOrders.new")
              : tab.value === "ASSEMBLING"
                ? t("sellerOrders.assembling")
                : tab.value === "IN_TRANSIT"
                  ? t("sellerOrders.inTransit")
                  : tab.value === "COMPLETED"
                    ? t("sellerOrders.completed")
                    : tab.value === "CANCELLED"
                      ? t("sellerOrders.cancelled")
                      : t("sellerOrders.archived"),
      })),
    [t],
  );

  const orders = response?.items ?? [];
  const summary = response?.summary ?? {
    ALL: 0,
    NEW: 0,
    ASSEMBLING: 0,
    IN_TRANSIT: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    ARCHIVED: 0,
  };

  const title = useMemo(
    () => localizedSellerTabs.find((tab) => tab.value === status)?.label ?? t("sellerOrders.orders"),
    [localizedSellerTabs, status, t],
  );

  useEffect(() => {
    hydrateWorkspace();
  }, [hydrateWorkspace]);

  const load = async () => {
    if (!user || !hydrated) {
      return;
    }

    setLoading(true);
    try {
      if (shops.length < 1) {
        await loadShops();
      }
      const shopId = useSellerWorkspaceStore.getState().currentShopId;
      if (!shopId) {
        setResponse(null);
        setError(null);
        return;
      }
      const next = await getShopOrders(
        shopId,
        {
          page,
          size,
          search: search || undefined,
          status: status === "ALL" ? undefined : status,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        "",
      );
      setResponse(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.productDetail.errorDescription"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShopId, dateFrom, dateTo, hydrated, loadShops, page, search, shops.length, size, status, user]);

  const handleArchive = async (order: SellerOrderListItem) => {
    if (!currentShopId) return;
    await runAction({
      action: async () => {
        await archiveShopOrder(currentShopId, order.id, "");
      },
      successMessage: t("sellerOrders.messages.archiveSuccess"),
      errorMessage: t("sellerOrders.messages.archiveFailed"),
      onSuccess: async () => {
        await load();
      },
    }).catch(() => {});
  };

  const handleHandoff = async (order: SellerOrderListItem) => {
    if (!currentShopId) return;
    await runAction({
      action: async () => {
        const detail = await getOrderDelivery(currentShopId, order.id, "");
        if (!detail.activeShipment) {
          throw new Error(t("sellerOrders.messages.handoffNoWaybill"));
        }
        await markManualDeliveryInTransit(
          currentShopId,
          order.id,
          detail.activeShipment.id,
          { note: "Seller handed over the package to delivery." },
          "",
        );
      },
      successMessage: t("sellerOrders.messages.handoffSuccess"),
      errorMessage: t("sellerOrders.messages.handoffFailed"),
      onSuccess: async () => {
        await load();
      },
    }).catch(() => {});
  };

  const handleComplete = async (order: SellerOrderListItem) => {
    if (!currentShopId) return;
    await runAction({
      action: async () => {
        const detail = await getOrderDelivery(currentShopId, order.id, "");
        if (!detail.activeShipment) {
          throw new Error(t("sellerOrders.messages.handoffNoWaybill"));
        }
        await markManualDeliveryDelivered(
          currentShopId,
          order.id,
          detail.activeShipment.id,
          { note: "Seller marked delivery completed from the orders queue." },
          "",
        );
      },
      successMessage: t("sellerOrders.messages.completeSuccess"),
      errorMessage: t("sellerOrders.messages.completeFailed"),
      onSuccess: async () => {
        await load();
      },
    }).catch(() => {});
  };

  const handleCancel = async (order: SellerOrderListItem) => {
    if (!currentShopId) return;
    await runAction({
      action: async () => {
        const detail = await getOrderDelivery(currentShopId, order.id, "");
        if (!detail.activeShipment) {
          throw new Error(t("sellerOrders.messages.handoffNoWaybill"));
        }
        await markManualDeliveryFailed(
          currentShopId,
          order.id,
          detail.activeShipment.id,
          {
            reasonCode: "SELLER_CANCELLED",
            reasonText: "Seller cancelled the order from fulfillment queue.",
            customerVisibleMessage: t("sellerOrders.messages.cancelCustomerMessage"),
          },
          "",
        );
      },
      successMessage: t("sellerOrders.messages.cancelSuccess"),
      errorMessage: t("sellerOrders.messages.cancelFailed"),
      onSuccess: async () => {
        await load();
      },
    }).catch(() => {});
  };

  const submitShipmentPanel = async () => {
    if (!currentShopId || !shipmentPanel) return;
    await runAction({
      action: async () => {
        await createManualDelivery(
          currentShopId,
          shipmentPanel.order.id,
          {
            provider: "YANDEX",
            manualYandexOrderId: shipmentPanel.manualYandexOrderId.trim() || null,
            trackingUrl: shipmentPanel.trackingUrl.trim() || null,
            yandexTrackingLink: shipmentPanel.trackingUrl.trim() || null,
            deliveryNote: shipmentPanel.note.trim() || null,
            note: "Seller created shipment from fulfillment queue.",
          },
          "",
        );
      },
      successMessage: t("sellerOrders.messages.shipmentSuccess"),
      errorMessage: t("sellerOrders.messages.shipmentFailed"),
      onSuccess: async () => {
        setShipmentPanel(null);
        await load();
      },
    }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow={t("sellerOrders.fulfillment")}
        title={t("sellerOrders.title")}
        description={t("sellerOrders.description")}
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seller order filters">
          {localizedSellerTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                status === tab.value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
              data-testid={`seller-order-tab-${tab.value}`}
            >
              {tab.label} ({summary[tab.value]})
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_180px_180px_180px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("sellerOrders.searchPlaceholder")}
            data-testid="seller-order-search"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <Button
            variant="outline"
            onClick={() => void load()}
          >
            {t("sellerPayments.reloadQueue")}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={t("sellerOrders.orders")}
        title={title}
        description={t("sellerOrders.ordersDescription")}
      >
        {error ? (
          <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[140px_1.2fr_1.2fr_140px_170px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>{t("sellerOrders.order")}</div>
            <div>{t("sellerOrders.buyer")}</div>
            <div>{t("sellerOrders.products")}</div>
            <div>{t("sellerOrders.amount")}</div>
            <div>{t("sellerOrders.delivery")}</div>
            <div>{t("sellerOrders.actions")}</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">{t("seller.results.loading")}</div>
            ) : orders.length ? (
              orders.map((order) => (
                <article key={order.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[140px_1.2fr_1.2fr_140px_170px_220px] lg:px-5" data-testid="seller-order-card">
                  <div>
                    <Link href={`/seller/orders/${order.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{order.sellerDisplayLabel}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">{order.customer.name}</p>
                    <p>{order.customer.phone}</p>
                    <p>{order.customer.email ?? t("sellerOrders.noEmail")}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item.id}>
                        {item.productTitleSnapshot} x {item.quantity}
                      </p>
                    ))}
                    {order.items.length > 2 ? <p>{t("sellerOrders.moreProducts", { count: order.items.length - 2 })}</p> : null}
                  </div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{order.totalAmount}</div>
                  <div className="text-sm text-[var(--muted)]">
                    <p>{order.delivery?.manualYandexOrderId ?? t("sellerOrders.noYandexId")}</p>
                    {order.delivery?.trackingUrl ? (
                      <a href={order.delivery.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[var(--accent)] underline">
                        {t("sellerOrders.trackYandex")}
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.sellerStatusBucket === "NEW" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setShipmentPanel({
                            order,
                            manualYandexOrderId: order.delivery?.manualYandexOrderId ?? "",
                            trackingUrl: order.delivery?.trackingUrl ?? "",
                            note: order.delivery?.deliveryNote ?? "",
                          })
                        }
                      >
                        {t("sellerOrders.createShipment")}
                      </Button>
                    )}
                    {order.sellerStatusBucket === "ASSEMBLING" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleHandoff(order)}
                        disabled={isRunning}
                        loading={isRunning}
                      >
                        {t("sellerOrders.handoff")}
                      </Button>
                    )}
                    {order.sellerStatusBucket === "IN_TRANSIT" && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => void handleComplete(order)}
                        disabled={isRunning}
                        loading={isRunning}
                      >
                        {t("sellerOrders.complete")}
                      </Button>
                    )}
                    {(order.sellerStatusBucket === "COMPLETED" || order.sellerStatusBucket === "CANCELLED") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleArchive(order)}
                        disabled={isRunning}
                        loading={isRunning}
                      >
                        {t("sellerOrders.archive")}
                      </Button>
                    )}
                    <ActionMenu
                      items={[
                        {
                          label: t("sellerOrders.details"),
                          href: `/seller/orders/${order.id}`,
                        },
                        ...(order.sellerStatusBucket === "IN_TRANSIT"
                          ? [
                              {
                                label: t("sellerOrders.cancelOrder"),
                                variant: "danger" as const,
                                confirm: t("sellerOrders.cancelConfirm"),
                                onClick: () => void handleCancel(order),
                                disabled: isRunning,
                                loading: isRunning,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">{t("sellerOrders.empty")}</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">{t("common.pageOf", { page: response?.meta.page ?? 1, total: response?.meta.totalPages ?? 1 })}</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t("sellerOrders.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (response?.meta.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              {t("sellerOrders.next")}
            </Button>
          </div>
        </div>
      </SectionCard>

      {shipmentPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("sellerOrders.createShipmentTitle")}</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{shipmentPanel.order.orderNumber}</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShipmentPanel(null)}
              >
                {t("common.close")}
              </Button>
            </div>

            <div className="mt-6 grid gap-4">
              <input
                value={shipmentPanel.manualYandexOrderId}
                onChange={(event) =>
                  setShipmentPanel((current) =>
                    current ? { ...current, manualYandexOrderId: event.target.value } : current,
                  )
                }
                placeholder={t("sellerOrders.manualYandexOrderIdPlaceholder")}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <input
                value={shipmentPanel.trackingUrl}
                onChange={(event) =>
                  setShipmentPanel((current) =>
                    current ? { ...current, trackingUrl: event.target.value } : current,
                  )
                }
                placeholder={t("sellerOrders.trackingUrlPlaceholder")}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <textarea
                value={shipmentPanel.note}
                onChange={(event) =>
                  setShipmentPanel((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                rows={4}
                placeholder={t("sellerOrders.deliveryNotePlaceholder")}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => void submitShipmentPanel()}
                disabled={isRunning}
                loading={isRunning}
              >
                {t("sellerOrders.saveAndAssemble")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
