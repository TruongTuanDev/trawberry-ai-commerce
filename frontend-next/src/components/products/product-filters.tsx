"use client";

type ProductFiltersValue = {
  search: string;
  status: string;
  stockStatus: string;
};

export function ProductFilters({
  value,
  onChange,
  onSubmit,
}: {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
      <input
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit();
          }
        }}
        placeholder="Search by product name, WB ID, brand or vendor code..."
        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      />
      <select
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value })}
        className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="DRAFT">Draft</option>
        <option value="ARCHIVED">Archived</option>
      </select>
      <select
        value={value.stockStatus}
        onChange={(event) => onChange({ ...value, stockStatus: event.target.value })}
        className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      >
        <option value="">All stock states</option>
        <option value="IN_STOCK">In stock</option>
        <option value="LOW_STOCK">Low stock</option>
        <option value="OUT_OF_STOCK">Out of stock</option>
      </select>
      <button
        type="button"
        onClick={onSubmit}
        className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
      >
        Apply filters
      </button>
    </div>
  );
}
