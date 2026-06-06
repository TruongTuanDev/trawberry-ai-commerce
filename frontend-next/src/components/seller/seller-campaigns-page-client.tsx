"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  archiveSellerCampaign,
  createSellerCampaign,
  getSellerCampaignPerformance,
  getShopProducts,
  listSellerCampaigns,
  removeSellerCampaignTarget,
  type ProductListItem,
  type SellerCampaign,
  type SellerCampaignPerformance,
  type SellerCampaignBillingMode,
  type SellerCampaignScenarioType,
  type SellerCampaignStatus,
  type SellerCampaignTargetStatus,
  upsertSellerCampaignTarget,
  updateSellerCampaign,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const SCENARIO_OPTIONS: SellerCampaignScenarioType[] = ["home", "similar", "search"];
const BILLING_OPTIONS: SellerCampaignBillingMode[] = ["none", "cpc", "cpm", "fixed"];
const STATUS_OPTIONS: SellerCampaignStatus[] = ["draft", "active", "paused", "ended", "archived"];
const TARGET_STATUS_OPTIONS: SellerCampaignTargetStatus[] = ["active", "paused", "removed"];
const CAMPAIGN_COPY = {
  eyebrow: "Campaigns",
  title: "Sponsored campaign manager",
  description:
    "Create, target, activate, and review sponsored campaigns with bounded recommendation boosts and CPC spend tracking.",
  currentShop: "Current shop",
  pickShop: "Pick a seller shop to manage campaigns.",
  totalCampaigns: "Campaign count",
  placeholderBilling: "Campaign billing",
  placeholderBillingDescription:
    "CPC recommendation click charging, spend tracking, and budget enforcement are now available for the V1 demo flow.",
  loading: "Loading campaigns...",
  loadFailed: "Unable to load seller campaigns.",
  submitting: "Saving...",
  createEyebrow: "Create",
  createTitle: "Create a campaign draft",
  createDescription:
    "Start with a draft, then attach product targets before moving the campaign to active.",
  createAction: "Create campaign",
  listEyebrow: "Manage",
  listTitle: "Campaign list",
  listDescription:
    "Edit lifecycle, targeting, and safe billing placeholders without exposing anything on public pages.",
  empty: "No campaigns yet for this shop.",
  saveCampaign: "Save campaign",
  archiveCampaign: "Archive campaign",
  targetTitle: "Product targets",
  targetDescription:
    "Attach published products from the current shop. Active campaigns will reject invalid or non-public products.",
  eligibleProducts: "Suggested published products",
  saveTarget: "Save target",
  removeTarget: "Remove target",
  noTargets: "No product targets yet.",
  billingPanelTitle: "Billing and performance",
  billingPanelDescription:
    "This panel shows the current campaign spend state plus recent sponsored events recorded for the campaign.",
  performanceTitle: "Performance snapshot",
  performanceAction: "Load performance",
  performanceLoading: "Loading performance...",
  noEvents: "No sponsored events yet.",
  fields: {
    name: "Campaign name",
    namePlaceholder: "Summer visibility push",
    description: "Description",
    descriptionPlaceholder:
      "Explain what this campaign should promote and what QA should watch.",
    scenarioTypes: "Scenario types",
    billingMode: "Billing mode placeholder",
    budgetLimit: "Budget limit placeholder",
    maxBoost: "Max boost",
    status: "Status",
    startAt: "Start at",
    endAt: "End at",
    productId: "Product id",
    targetBoost: "Target boost",
    targetStatus: "Target status",
  },
  summary: {
    totalTargets: "Targets",
    activeTargets: "Active",
    removedTargets: "Removed",
    spentAmount: "Spent",
    remainingBudget: "Remaining",
    billableClicks: "Billable clicks",
  },
  table: {
    product: "Product",
    status: "Status",
    boost: "Boost",
    actions: "Actions",
  },
  messages: {
    createSuccess: "Campaign created.",
    createFailed: "Unable to create campaign.",
    updateSuccess: "Campaign updated.",
    updateFailed: "Unable to update campaign.",
    archiveSuccess: "Campaign archived.",
    archiveFailed: "Unable to archive campaign.",
    targetSaved: "Target saved.",
    targetSaveFailed: "Unable to save target.",
    targetRemoved: "Target removed.",
    targetRemoveFailed: "Unable to remove target.",
  },
} as const;

type CampaignFormState = {
  name: string;
  description: string;
  scenarioTypes: SellerCampaignScenarioType[];
  startAt: string;
  endAt: string;
  budgetLimit: string;
  billingMode: SellerCampaignBillingMode;
  maxBoost: string;
  status: SellerCampaignStatus;
};

type TargetFormState = {
  productId: string;
  boost: string;
  status: SellerCampaignTargetStatus;
};

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function buildCampaignForm(campaign?: SellerCampaign | null): CampaignFormState {
  return {
    name: campaign?.name ?? "",
    description: campaign?.description ?? "",
    scenarioTypes: campaign?.scenarioTypes ?? ["home"],
    startAt: toDatetimeLocal(campaign?.startAt ?? null),
    endAt: toDatetimeLocal(campaign?.endAt ?? null),
    budgetLimit: campaign?.budgetLimit ?? "",
    billingMode: (campaign?.billingMode as SellerCampaignBillingMode) ?? "none",
    maxBoost: campaign?.maxBoost ?? "0",
    status: (campaign?.status as SellerCampaignStatus) ?? "draft",
  };
}

export function SellerCampaignsPageClient() {
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);

  const [campaigns, setCampaigns] = useState<SellerCampaign[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [campaignDrafts, setCampaignDrafts] = useState<Record<string, CampaignFormState>>({});
  const [targetDrafts, setTargetDrafts] = useState<Record<string, TargetFormState>>({});
  const [performanceByCampaign, setPerformanceByCampaign] = useState<Record<string, SellerCampaignPerformance>>({});
  const [loadingPerformanceId, setLoadingPerformanceId] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CampaignFormState>(buildCampaignForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const copy = CAMPAIGN_COPY;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const refresh = async (shopId = currentShopId) => {
    if (!shopId) {
      setCampaigns([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    const [nextCampaigns, nextProducts] = await Promise.all([
      listSellerCampaigns(shopId),
      getShopProducts(
        shopId,
        {
          page: 1,
          size: 12,
          catalogStatus: "PUBLISHED",
          visibility: "ACTIVE",
          sort: "updatedAt_desc",
        },
      ),
    ]);

    setCampaigns(nextCampaigns);
    setProducts(nextProducts.items);
    setPerformanceByCampaign((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([campaignId]) =>
          nextCampaigns.some((campaign) => campaign.id === campaignId),
        ),
      ),
    );
    setCampaignDrafts(
      Object.fromEntries(
        nextCampaigns.map((campaign) => [campaign.id, buildCampaignForm(campaign)]),
      ),
    );
    setTargetDrafts(
      Object.fromEntries(
        nextCampaigns.map((campaign) => [
          campaign.id,
          { productId: "", boost: campaign.maxBoost, status: "active" },
        ]),
      ),
    );
  };

  useEffect(() => {
    if (!hydrated) return;
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        if (shops.length < 1) {
          await loadShops();
        }
        if (!active) return;
        const shopId = useSellerWorkspaceStore.getState().currentShopId;
        if (!shopId) {
          setCampaigns([]);
          setProducts([]);
          setCampaignDrafts({});
          setTargetDrafts({});
          setError(null);
          return;
        }
        const [nextCampaigns, nextProducts] = await Promise.all([
          listSellerCampaigns(shopId),
          getShopProducts(
            shopId,
            {
              page: 1,
              size: 12,
              catalogStatus: "PUBLISHED",
              visibility: "ACTIVE",
              sort: "updatedAt_desc",
            },
          ),
        ]);
        if (!active) return;
        setCampaigns(nextCampaigns);
        setProducts(nextProducts.items);
        setCampaignDrafts(
          Object.fromEntries(
            nextCampaigns.map((campaign) => [campaign.id, buildCampaignForm(campaign)]),
          ),
        );
        setTargetDrafts(
          Object.fromEntries(
            nextCampaigns.map((campaign) => [
              campaign.id,
              { productId: "", boost: campaign.maxBoost, status: "active" },
            ]),
          ),
        );
        setError(null);
      } catch (issue) {
        if (active) {
          setError(issue instanceof Error ? issue.message : copy.loadFailed);
          setError(issue instanceof Error ? issue.message : copy.loadFailed);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [copy.loadFailed, currentShopId, hydrated, loadShops, shops.length]);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  const handleCreate = async () => {
    if (!currentShopId) return;
    setSubmitting(true);
    try {
      await createSellerCampaign(currentShopId, {
        name: createForm.name,
        description: createForm.description || undefined,
        status: createForm.status,
        scenarioTypes: createForm.scenarioTypes,
        startAt: fromDatetimeLocal(createForm.startAt),
        endAt: fromDatetimeLocal(createForm.endAt),
        budgetLimit: createForm.budgetLimit ? Number(createForm.budgetLimit) : null,
        billingMode: createForm.billingMode,
        maxBoost: Number(createForm.maxBoost || 0),
      });
      await refresh();
      setCreateForm(buildCampaignForm());
      setMessage(copy.messages.createSuccess);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : copy.messages.createFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCampaign = async (campaignId: string) => {
    if (!currentShopId) return;
    const draft = campaignDrafts[campaignId];
    if (!draft) return;

    setSubmitting(true);
    try {
      await updateSellerCampaign(currentShopId, campaignId, {
        name: draft.name,
        description: draft.description || null,
        status: draft.status,
        scenarioTypes: draft.scenarioTypes,
        startAt: fromDatetimeLocal(draft.startAt),
        endAt: fromDatetimeLocal(draft.endAt),
        budgetLimit: draft.budgetLimit ? Number(draft.budgetLimit) : null,
        billingMode: draft.billingMode,
        maxBoost: Number(draft.maxBoost || 0),
      });
      await refresh();
      setMessage(copy.messages.updateSuccess);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : copy.messages.updateFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveCampaign = async (campaignId: string) => {
    if (!currentShopId) return;
    setSubmitting(true);
    try {
      await archiveSellerCampaign(currentShopId, campaignId);
      await refresh();
      setMessage(copy.messages.archiveSuccess);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : copy.messages.archiveFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTargetSave = async (campaignId: string) => {
    if (!currentShopId) return;
    const draft = targetDrafts[campaignId];
    if (!draft?.productId.trim()) return;

    setSubmitting(true);
    try {
      await upsertSellerCampaignTarget(currentShopId, campaignId, {
        productId: draft.productId.trim(),
        boost: Number(draft.boost || 0),
        status: draft.status,
      });
      await refresh();
      setTargetDrafts((current) => ({
        ...current,
        [campaignId]: {
          productId: "",
          boost: current[campaignId]?.boost ?? "0",
          status: "active",
        },
      }));
      setMessage(copy.messages.targetSaved);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : copy.messages.targetSaveFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTargetRemove = async (campaignId: string, targetId: string) => {
    if (!currentShopId) return;
    setSubmitting(true);
    try {
      await removeSellerCampaignTarget(currentShopId, campaignId, targetId);
      await refresh();
      setMessage(copy.messages.targetRemoved);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : copy.messages.targetRemoveFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePerformance = async (campaignId: string) => {
    if (!currentShopId) return;

    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      return;
    }

    setExpandedCampaignId(campaignId);
    if (performanceByCampaign[campaignId]) {
      return;
    }

    setLoadingPerformanceId(campaignId);
    try {
      const performance = await getSellerCampaignPerformance(currentShopId, campaignId);
      setPerformanceByCampaign((current) => ({
        ...current,
        [campaignId]: performance,
      }));
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load campaign performance.");
    } finally {
      setLoadingPerformanceId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="seller-campaigns-page">
      <SectionCard
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="text-sm text-[var(--muted)]">{copy.currentShop}</p>
            <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
              {currentShop?.name ?? copy.pickShop}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="text-sm text-[var(--muted)]">{copy.totalCampaigns}</p>
            <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{campaigns.length}</p>
          </article>
          <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="text-sm text-[var(--muted)]">{copy.placeholderBilling}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
              {copy.placeholderBillingDescription}
            </p>
          </article>
        </div>

        {loading ? <p className="mt-6 text-sm text-[var(--muted)]">{copy.loading}</p> : null}
        {error ? <p className="mt-6 text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="mt-6 text-sm text-[var(--success)]">{message}</p> : null}
      </SectionCard>

      <SectionCard
        eyebrow={copy.createEyebrow}
        title={copy.createTitle}
        description={copy.createDescription}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.name}</span>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={copy.fields.namePlaceholder}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.maxBoost}</span>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              type="number"
              min="0"
              step="0.1"
              value={createForm.maxBoost}
              onChange={(event) => setCreateForm((current) => ({ ...current, maxBoost: event.target.value }))}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.description}</span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={copy.fields.descriptionPlaceholder}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.billingMode}</span>
            <select
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              value={createForm.billingMode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  billingMode: event.target.value as SellerCampaignBillingMode,
                }))
              }
            >
              {BILLING_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.budgetLimit}</span>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              type="number"
              min="0"
              step="0.01"
              value={createForm.budgetLimit}
              onChange={(event) => setCreateForm((current) => ({ ...current, budgetLimit: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.startAt}</span>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              type="datetime-local"
              value={createForm.startAt}
              onChange={(event) => setCreateForm((current) => ({ ...current, startAt: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.endAt}</span>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
              type="datetime-local"
              value={createForm.endAt}
              onChange={(event) => setCreateForm((current) => ({ ...current, endAt: event.target.value }))}
            />
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.scenarioTypes}</span>
            <div className="flex flex-wrap gap-3">
              {SCENARIO_OPTIONS.map((scenario) => {
                const checked = createForm.scenarioTypes.includes(scenario);
                return (
                  <label key={scenario} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setCreateForm((current) => ({
                          ...current,
                          scenarioTypes: checked
                            ? current.scenarioTypes.filter((item) => item !== scenario)
                            : [...current.scenarioTypes, scenario],
                        }))
                      }
                    />
                    <span>{scenario}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] disabled:opacity-60"
            disabled={submitting || !currentShopId}
            onClick={() => void handleCreate()}
            type="button"
          >
            {submitting ? copy.submitting : copy.createAction}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={copy.listEyebrow}
        title={copy.listTitle}
        description={copy.listDescription}
      >
        {campaigns.length < 1 ? (
          <p className="text-sm text-[var(--muted)]">{copy.empty}</p>
        ) : (
          <div className="space-y-5">
            {campaigns.map((campaign) => {
              const draft = campaignDrafts[campaign.id] ?? buildCampaignForm(campaign);
              const targetDraft = targetDrafts[campaign.id] ?? {
                productId: "",
                boost: campaign.maxBoost,
                status: "active" as const,
              };

              return (
                <article
                  key={campaign.id}
                  className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{campaign.name}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {campaign.status} | {campaign.scenarioTypes.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span className="rounded-full border border-[var(--border)] px-3 py-1">
                        {copy.summary.totalTargets}: {campaign.summary.totalTargets}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1">
                        {copy.summary.activeTargets}: {campaign.summary.activeTargets}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1">
                        {copy.summary.spentAmount}: {campaign.billing.spentAmount}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1">
                        {copy.summary.remainingBudget}: {campaign.billing.remainingBudget ?? "∞"}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1">
                        {copy.summary.billableClicks}: {campaign.billing.billableClicks}
                      </span>
                      <span className="rounded-full border border-[var(--border)] px-3 py-1">
                        {copy.summary.removedTargets}: {campaign.summary.removedTargets}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.name}</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        value={draft.name}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: { ...draft, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.status}</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        value={draft.status}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: {
                              ...draft,
                              status: event.target.value as SellerCampaignStatus,
                            },
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.description}</span>
                      <textarea
                        className="min-h-20 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        value={draft.description}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: { ...draft, description: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.maxBoost}</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.maxBoost}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: { ...draft, maxBoost: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.billingMode}</span>
                      <select
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        value={draft.billingMode}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: {
                              ...draft,
                              billingMode: event.target.value as SellerCampaignBillingMode,
                            },
                          }))
                        }
                      >
                        {BILLING_OPTIONS.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.startAt}</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        type="datetime-local"
                        value={draft.startAt}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: { ...draft, startAt: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.endAt}</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        type="datetime-local"
                        value={draft.endAt}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: { ...draft, endAt: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.budgetLimit}</span>
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.budgetLimit}
                        onChange={(event) =>
                          setCampaignDrafts((current) => ({
                            ...current,
                            [campaign.id]: { ...draft, budgetLimit: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <div className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.scenarioTypes}</span>
                      <div className="flex flex-wrap gap-3">
                        {SCENARIO_OPTIONS.map((scenario) => {
                          const checked = draft.scenarioTypes.includes(scenario);
                          return (
                            <label key={scenario} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setCampaignDrafts((current) => ({
                                    ...current,
                                    [campaign.id]: {
                                      ...draft,
                                      scenarioTypes: checked
                                        ? draft.scenarioTypes.filter((item) => item !== scenario)
                                        : [...draft.scenarioTypes, scenario],
                                    },
                                  }))
                                }
                              />
                              <span>{scenario}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] disabled:opacity-60"
                      disabled={submitting}
                      onClick={() => void handleSaveCampaign(campaign.id)}
                      type="button"
                    >
                      {copy.saveCampaign}
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60"
                      disabled={submitting || campaign.status === "archived"}
                      onClick={() => void handleArchiveCampaign(campaign.id)}
                      type="button"
                    >
                      {copy.archiveCampaign}
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60"
                      disabled={loadingPerformanceId === campaign.id}
                      onClick={() => void handleTogglePerformance(campaign.id)}
                      type="button"
                    >
                      {loadingPerformanceId === campaign.id
                        ? copy.performanceLoading
                        : copy.performanceAction}
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">{copy.targetTitle}</h4>
                      <p className="mt-1 text-sm text-[var(--muted)]">{copy.targetDescription}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 md:col-span-1">
                        <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.productId}</span>
                        <input
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
                          value={targetDraft.productId}
                          onChange={(event) =>
                            setTargetDrafts((current) => ({
                              ...current,
                              [campaign.id]: { ...targetDraft, productId: event.target.value },
                            }))
                          }
                          placeholder="product-uuid"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.targetBoost}</span>
                        <input
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
                          type="number"
                          min="0"
                          step="0.1"
                          value={targetDraft.boost}
                          onChange={(event) =>
                            setTargetDrafts((current) => ({
                              ...current,
                              [campaign.id]: { ...targetDraft, boost: event.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-[var(--foreground)]">{copy.fields.targetStatus}</span>
                        <select
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm"
                          value={targetDraft.status}
                          onChange={(event) =>
                            setTargetDrafts((current) => ({
                              ...current,
                              [campaign.id]: {
                                ...targetDraft,
                                status: event.target.value as SellerCampaignTargetStatus,
                              },
                            }))
                          }
                        >
                          {TARGET_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-[var(--background)] disabled:opacity-60"
                        disabled={submitting}
                        onClick={() => void handleTargetSave(campaign.id)}
                        type="button"
                      >
                        {copy.saveTarget}
                      </button>
                    </div>

                    <div className="rounded-[1.25rem] border border-dashed border-[var(--border)] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {copy.eligibleProducts}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {products.map((product) => (
                          <button
                            key={product.id}
                            className="rounded-full border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--foreground)]"
                            onClick={() =>
                              setTargetDrafts((current) => ({
                                ...current,
                                [campaign.id]: { ...targetDraft, productId: product.id },
                              }))
                            }
                            type="button"
                          >
                            {product.title} | {product.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-[var(--muted)]">
                          <tr>
                            <th className="px-3 py-2 font-medium">{copy.table.product}</th>
                            <th className="px-3 py-2 font-medium">{copy.table.status}</th>
                            <th className="px-3 py-2 font-medium">{copy.table.boost}</th>
                            <th className="px-3 py-2 font-medium">{copy.table.actions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaign.targets.map((target) => (
                            <tr key={target.id} className="border-t border-[var(--border)]">
                              <td className="px-3 py-3">
                                <div className="font-medium text-[var(--foreground)]">{target.product.name}</div>
                                <div className="text-xs text-[var(--muted)]">{target.productId}</div>
                              </td>
                              <td className="px-3 py-3 text-[var(--muted)]">{target.status}</td>
                              <td className="px-3 py-3 text-[var(--foreground)]">{target.boost}</td>
                              <td className="px-3 py-3">
                                <button
                                  className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] disabled:opacity-60"
                                  disabled={submitting}
                                  onClick={() => void handleTargetRemove(campaign.id, target.id)}
                                  type="button"
                                >
                                  {copy.removeTarget}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {campaign.targets.length < 1 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                                {copy.noTargets}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--background)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{copy.billingPanelTitle}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {copy.billingPanelDescription}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <article className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Mode</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{campaign.billing.mode}</p>
                      </article>
                      <article className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Budget</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {campaign.billing.budgetLimit ?? "Unlimited"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Remaining {campaign.billing.remainingBudget ?? "∞"}
                        </p>
                      </article>
                      <article className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">CPC</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{campaign.billing.cpcAmount}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Charged clicks {campaign.billing.chargedClicks} / total billed {campaign.billing.totalChargedEvents}
                        </p>
                      </article>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
                      {campaign.billing.notes.map((note) => (
                        <li key={note}>- {note}</li>
                      ))}
                    </ul>
                    {expandedCampaignId === campaign.id ? (
                      <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{copy.performanceTitle}</p>
                        {performanceByCampaign[campaign.id] ? (
                          <>
                            <div className="mt-3 grid gap-3 md:grid-cols-4">
                              <article className="rounded-[1rem] border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]">
                                Events {performanceByCampaign[campaign.id].summary.totalEvents}
                              </article>
                              <article className="rounded-[1rem] border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]">
                                Sponsored {performanceByCampaign[campaign.id].summary.servedAsSponsored ? "Yes" : "No"}
                              </article>
                              <article className="rounded-[1rem] border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]">
                                Wallet blocked {performanceByCampaign[campaign.id].summary.walletBlocked ? "Yes" : "No"}
                              </article>
                              <article className="rounded-[1rem] border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]">
                                Budget exhausted {performanceByCampaign[campaign.id].summary.budgetExhausted ? "Yes" : "No"}
                              </article>
                            </div>
                            <div className="mt-4 overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="text-left text-[var(--muted)]">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">Time</th>
                                    <th className="px-3 py-2 font-medium">Product</th>
                                    <th className="px-3 py-2 font-medium">Type</th>
                                    <th className="px-3 py-2 font-medium">Status</th>
                                    <th className="px-3 py-2 font-medium">Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {performanceByCampaign[campaign.id].recentEvents.map((event) => (
                                    <tr key={event.id} className="border-t border-[var(--border)]">
                                      <td className="px-3 py-3 text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}</td>
                                      <td className="px-3 py-3 text-[var(--foreground)]">{event.productName}</td>
                                      <td className="px-3 py-3 text-[var(--foreground)]">{event.type}</td>
                                      <td className="px-3 py-3 text-[var(--muted)]">{event.chargeStatus}</td>
                                      <td className="px-3 py-3 text-[var(--foreground)]">{event.cost ?? "-"}</td>
                                    </tr>
                                  ))}
                                  {performanceByCampaign[campaign.id].recentEvents.length < 1 ? (
                                    <tr>
                                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                                        {copy.noEvents}
                                      </td>
                                    </tr>
                                  ) : null}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : loadingPerformanceId === campaign.id ? (
                          <p className="mt-3 text-sm text-[var(--muted)]">{copy.performanceLoading}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
