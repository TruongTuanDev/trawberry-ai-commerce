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
  { value: "ALL", label: "Tất cả" },
  { value: "NEW", label: "Mới" },
  { value: "ASSEMBLING", label: "Lắp ráp" },
  { value: "IN_TRANSIT", label: "Trong quá trình giao hàng" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "ARCHIVED", label: "Lưu trữ" },
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
      setError(err instanceof Error ? err.message : "Unable to load orders.");
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
      successMessage: "Đã lưu trữ đơn hàng.",
      errorMessage: "Không thể lưu trữ đơn hàng.",
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
          throw new Error("Đơn chưa có vận đơn để bàn giao.");
        }
        await markManualDeliveryInTransit(
          currentShopId,
          order.id,
          detail.activeShipment.id,
          { note: "Seller handed over the package to delivery." },
          "",
        );
      },
      successMessage: "Đã bàn giao cho vận chuyển.",
      errorMessage: "Không thể bàn giao đơn cho vận chuyển.",
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
          throw new Error("Đơn chưa có vận đơn hoạt động.");
        }
        await markManualDeliveryDelivered(
          currentShopId,
          order.id,
          detail.activeShipment.id,
          { note: "Seller marked delivery completed from the orders queue." },
          "",
        );
      },
      successMessage: "Đã chuyển đơn sang Hoàn thành.",
      errorMessage: "Không thể hoàn thành đơn.",
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
          throw new Error("Đơn chưa có vận đơn hoạt động.");
        }
        await markManualDeliveryFailed(
          currentShopId,
          order.id,
          detail.activeShipment.id,
          {
            reasonCode: "SELLER_CANCELLED",
            reasonText: "Seller cancelled the order from fulfillment queue.",
            customerVisibleMessage: "Đơn hàng đã được người bán hủy trong quá trình giao.",
          },
          "",
        );
      },
      successMessage: "Đã chuyển đơn sang Đã hủy.",
      errorMessage: "Không thể hủy đơn đang giao.",
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
      successMessage: "Đã tạo đơn vận chuyển và chuyển sang Lắp ráp.",
      errorMessage: "Không thể tạo đơn vận chuyển.",
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
        description="Luồng xử lý đơn hàng tách riêng khỏi payment review. Chỉ các đơn đã xác nhận thanh toán mới xuất hiện trong các bucket vận hành."
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
            Tải lại
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={t("sellerOrders.orders")}
        title={title}
        description="Hành động thay đổi theo bucket để seller biết rõ bước tiếp theo của từng đơn."
      >
        {error ? (
          <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[140px_1.2fr_1.2fr_140px_170px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>Đơn</div>
            <div>{t("sellerOrders.buyer")}</div>
            <div>Sản phẩm</div>
            <div>Số tiền</div>
            <div>Vận chuyển</div>
            <div>Hành động</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading orders...</div>
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
                    <p>{order.customer.email ?? "No email"}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item.id}>
                        {item.productTitleSnapshot} x {item.quantity}
                      </p>
                    ))}
                    {order.items.length > 2 ? <p>+{order.items.length - 2} sản phẩm</p> : null}
                  </div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{order.totalAmount}</div>
                  <div className="text-sm text-[var(--muted)]">
                    <p>{order.delivery?.manualYandexOrderId ?? "Chưa có mã Yandex"}</p>
                    {order.delivery?.trackingUrl ? (
                      <a href={order.delivery.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[var(--accent)] underline">
                        Theo dõi Yandex
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
                        Tạo đơn vận chuyển
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
                        Bàn giao vận chuyển
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
                        Hoàn thành
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
                        Lưu trữ
                      </Button>
                    )}
                    <ActionMenu
                      items={[
                        {
                          label: "Chi tiết",
                          href: `/seller/orders/${order.id}`,
                        },
                        ...(order.sellerStatusBucket === "IN_TRANSIT"
                          ? [
                              {
                                label: "Hủy đơn",
                                variant: "danger" as const,
                                confirm: "Bạn có chắc chắn muốn hủy đơn hàng này?",
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
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Không có đơn nào trong bucket này.</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">Page {response?.meta.page ?? 1} of {response?.meta.totalPages ?? 1}</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Tạo đơn vận chuyển</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{shipmentPanel.order.orderNumber}</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShipmentPanel(null)}
              >
                Đóng
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
                placeholder="manualYandexOrderId"
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
              <input
                value={shipmentPanel.trackingUrl}
                onChange={(event) =>
                  setShipmentPanel((current) =>
                    current ? { ...current, trackingUrl: event.target.value } : current,
                  )
                }
                placeholder="trackingUrl (nếu có)"
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
                placeholder="Ghi chú cho vận đơn"
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
                Lưu và chuyển sang Lắp ráp
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
